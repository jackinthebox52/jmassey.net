# The Problem

I have a Tesla V100 sitting around, and I wanted to run Qwen3.8-27B on it for agentic workloads, which in practice means long context, sometimes out past 128K tokens, with a lot of back-and-forth tool calls in a single session. The V100 is sm_70, which is Volta, which is old enough now that most serving stacks either do not bother supporting it or support it badly. I think the card is still perfectly capable for a model this size, so the actual problem was getting llama.cpp to use it well rather than the hardware being incapable.

Stock llama.cpp on this card gets 35.95 tok/s at 1K tokens of context and drops to roughly 16.49 tok/s at 128K. That drop is probably the whole story, because agentic sessions live at the long-context end, not the short end, and a brwoser-use agent grinding through a 100K token conversation at 16 tok/s is not something I wanted to sit around waiting on.

## Two Ways to Fix It

We ended up with two separate builds rather than one. The two fixes do not compose cleanly, and each one is probably the right answer for a different situation.

**MTP mode**, which is the default, uses the model's own embedded Multi-Token Prediction head to speculatively draft 3 to 7 tokens per pass and batch-verify them against the full model. This one runs on stock llama.cpp, no patching required, since the 4-wide verification batch already amortizes the KV cache reads well enough on its own. At 128K context this gets 42.22 tok/s, a 156% speedup over stock.

**The `--no-mtp` build**, on the other hand, patches llama.cpp directly. Qwen3.8 uses grouped-query attention with 24 query heads mapped to 4 KV heads, a 6:1 ratio, and stock llama.cpp's `flash_attn_ext_vec` kernel only packs KV heads in powers of two. That likely means every KV head gets read roughly 3 times more than it needs to be, since 6 does not divide evenly into any power-of-two packing scheme the kernel supports. The T2-001 patch adds `ncols2 = 3` support to the kernel so it can pack in groups of 3 instead of forcing a power-of-two split, which should eliminate most of that redundant KV traffic. This build reaches 23.83 tok/s at 128K, which is a smaller gain (about 45%) than MTP mode, but it decodes deterministically instead of speculatively, and there are probably agentic workflows where I would rather have that than the extra throughput.

STOP: I initially assumed the two techniques would stack, MTP drafting on top of the packed-attention kernel. They do not, at least not yet. MTP's verification batching and the packed KV read pattern end up fighting over the same memory bandwidth, in a way that is not obviously fixable without touching the batch scheduler, so for now they ship as two separate binaries built from two separate configurations.

## Multi-Turn Is Where It Actually Matters

Raw tok/s numbers understate the real win for agentic use. With prompt caching enabled, a multi-turn session (the kind an actual agent produces, tool call, tool result, next tool call) goes from 22.94 seconds per turn cold to 3.08 seconds per turn cached. That is a 7.45x improvement in wall time. Most of an agent's context does not change turn to turn, so re-prefilling all of it every time was probably the single biggest waste in the stock setup, larger even than the attention kernel inefficiency.

## Getting It Running

The stack requires driver R525.60.13 through R580.xx, since R580 is likely the last driver branch with Volta support at all, and CUDA 12.0 through 12.9, since CUDA 13.x dropped sm_70 entirely. `--parallel 1` is mandatory, and multi-slot KV caching at 128K reliably OOMs, which makes sense given how much KV cache a single 128K sequence already needs on a 32GB card, though it still cost about an hour of confused restarts before I gave up on that path. GPU clock locking via `lock-clocks.sh` also matters more than expected, since thermal throttling on a card this old will quietly drift the tok/s number down mid-benchmark if nobody is watching for it.

## Where This Stands

The MTP path is the one I would recommend by default, but the packed-attention kernel is the more interesting piece of work, and it is not finished. Further kernel optimization on the `ncols2` packing is underway, and I think there is more headroom left in it than the current 23.83 tok/s suggests, particularly around how the kernel handles the tail end of a batch that does not divide evenly into groups of 3. This is very much an ongoing project, and I will be posting further findings here as they come in.

Repo is on [GitHub](https://github.com/jackinthebox52/qwen38-v100-serve) if anyone wants to follow along or run it. It works well enough for daily use on my end, which is probably the bar that actually matters right now.
