An LSTM with an external memory bank where every slot learns its own period. The mechanism works, but the results have not proven groundbreaking. This project served as more of a learnign experience for myself, using claude Opus to learn good research practices while getting hands-on experience with custom model implementations in PyTorch.

## Background

Standard attention over an external memory bank is content-based. You project the controller's hidden state into a query, dot it against a bank of keys, softmax, and read out a weighted sum of values.

It stands to reason that time-based addressing could be of value here, especially in tasks like MNIST recognitionwhere there is a repetitive grid structure inherent to the pixel data. Signals such as "slot 7 is the one that matters every 33 steps." should prove to be useful.

So I gave each slot a period. Every memory slot `i` gets a trainable parameter `p_i`, and its content-based attention weight gets multiplied by `(1 + beta_i * cos(2*pi*t / p_i))` at step `t`. The idea is that the network can learn a set of clocks running at different rates, and slots can specialize to temporal scales instead of only to content. A slot with a short period fires constantly. A slot with a period longer than the sequence never oscillates at all and just acts as persistent storage.

I called it the Harmonic Memory Network, a work in progress.

As far as I can tell the combination is actually new. NTM and DNC have content-based and location-based addressing but no learnable periodicity. Legendre Memory Units use a fixed orthogonal basis, not learned frequencies. Oscillatory RNNs put the oscillation in the hidden state dynamics, not in memory addressing. Transformers have learned positional encodings, but on the input representation, not on which memory slot you're allowed to touch.

## Architecture

- LSTM controller, hidden size 256
- External memory bank, 32 slots, 128-dim key and 128-dim value per slot
- Content-based attention, then harmonic modulation on top of the resulting weights
- Linear classifier head on the final hidden state

Benchmark is pixel-by-pixel Sequential MNIST and Permuted Sequential MNIST. 784 timesteps, input size 1. It's the standard long-range memory benchmark in the recurrent literature, which is the only reason I picked it. Foreshadowing.

Three configs, two tasks, which gives a clean ablation grid:

1. **Vanilla LSTM baseline** — no memory bank at all
2. **No-resonance HMN** — memory bank, content addressing only, resonance disabled
3. **Full HMN** — memory bank plus harmonic modulation

The gap between 2 and 3 is the entire claim. Everything else is scaffolding.

Training: AdamW, lr 1e-4, batch 256, cosine annealing, grad clip 1.0, early stopping with patience 15 and a 20 epoch warmup, max 200 epochs. One GPU, 32GB. lr 1e-3 produced literally zero learning, which I assume is gradient instability over a 784-step BPTT chain.

## Bug One: The Memory Was Never Plugged In

First real implementation, and the memory loop and the LSTM weren't interleaved. The memory read/write loop ran start to finish with `h` as zeros, and then the batched LSTM ran afterward over the whole sequence.

The memory never saw a single real hidden state. It was reading and writing against a zero vector for 784 steps and then the LSTM did the actual classification by itself.

The annoying part is that it trained fine. Loss went down, accuracy went up, nothing crashed. It just wasn't the architecture I thought I was running. Fixed by properly interleaving the read and write with the controller steps.

## Chunking, Which Was Supposed to Be a Speed Fix

The per-pixel version does 784 Python-level `LSTMCell` iterations with a memory access at every one. 309 seconds per epoch. That's slow enough that a single ablation grid eats a weekend.

The fix was to chunk it: swap `LSTMCell` for `nn.LSTM` so cuDNN handles a whole chunk of pixels in one fused call, and only touch memory at chunk boundaries. At `chunk_size=8` that's 98 memory accesses instead of 784.

52 seconds per epoch. Six times faster, exactly as hoped.

What I didn't expect was that it changed the results:

| Config | chunk_size=1 | chunk_size=8 | Delta |
|---|---|---|---|
| No-resonance, sequential | 96.86% | 97.57% | +0.71 |
| No-resonance, permuted | 76.85% | 91.29% | **+14.44** |
| Full HMN, permuted | diverged (NaN / 38%) | 93.52% | recovered |

Fourteen points on permuted, and a config that previously diverged to NaN at epoch 11 now trains to convergence.

My read is that chunking is regularization, not just an optimization. It cuts the effective BPTT depth through the memory loop by 8x, and it forces a division of labor: the LSTM handles local sequential structure inside a chunk, the memory bank only gets to participate in longer-range structure. The read vector is stale within a chunk, and staleness turns out to be useful.

That 76.85% number is worth sitting with. Content-based memory at every pixel *hurt* on permuted MNIST, badly. My guess is the memory was exploiting raster-scan locality on sequential MNIST, and when the permutation destroys that locality the same mechanism becomes a liability. Chunking takes the crutch away.

## What Looked Like a Result

At this point the permuted numbers lined up the way you'd want:

| Config | Permuted MNIST |
|---|---|
| Vanilla LSTM | 89.38% |
| No-resonance HMN | 91.29% |
| Full HMN | **93.52%** |

Memory beats no memory. Resonance beats no resonance. Two point gap on the ablation that matters. I started drafting a paper outline.

## The Periods Were Never Learning

I had been logging period statistics per epoch, mostly as a sanity check. Min, max, mean, standard deviation.

Every one of them was a flat horizontal line. Mean pinned at about 117 for the entire run. Same value across chunk sizes. Same value across seeds. Same value at epoch 1 and epoch 90.

117 is roughly the mean of the log-uniform distribution I was initializing periods from. The periods were sitting exactly where they were born and not moving.

Which means the "harmonic" part of the Harmonic Memory Network was a fixed random positional encoding. Every number in the table above was produced by a mechanism that was not doing the thing I was claiming it did. The 93.52% might still be real, in the sense that random multi-scale periodic modulation could genuinely help. But it is not evidence for *learnable* periods, and learnable periods are the whole contribution.

Printing gradient norms on the period parameters confirmed it: 1e-6 to 5e-4, orders of magnitude below everything else in the model. Dead zone.

## Three Reasons, All Stacked

**Aliasing.** Resonance was computed over pixel indices 0 to 783, but with chunking only the values at chunk boundaries are ever used. At `chunk_size=28`, the 28 sampled resonance values are spaced 28 pixels apart, so anything with a period shorter than 56 pixels is aliased. Roughly half the initialized periods were in that regime, producing gradient signal that was noise.

**The derivative itself.** For a linear period parameterization,

```
d/dp cos(2*pi*t/p) = sin(2*pi*t/p) * (2*pi*t / p^2)
```

That `1/p^2` term crushes the gradient for large periods, and the `sin` term flips sign across timesteps so contributions partially cancel when summed over the sequence. A slot initialized at period 400 was never going to move.

**Learning rate.** Periods shared the main optimizer at a 0.1x multiplier, so 1e-5 against a base of 1e-4. Cosine annealing then drove that toward zero over training. Tiny gradients times a decaying tiny learning rate is float32 noise floor territory.

Any one of these alone would have been survivable. All three together meant the parameter was frozen by construction.

## The Fixes

Reparameterize to log space, so the optimizer works on `log_periods` and the actual period is `exp(log_period)`. This turns the `1/p^2` suppression into something well-behaved across scales, since a fixed step in log space is a proportional step in period.

```python
# stored parameter is log-space
self.log_periods = nn.Parameter(torch.log(init_periods))

# forward
periods = torch.exp(self.log_periods)
resonance = torch.cos(2 * math.pi * chunk_idx / periods)
attn = content_attn * (1 + self.beta * resonance)
```

Compute resonance in chunk-step space, not pixel space. `chunk_idx` runs 0 to 97 at `chunk_size=8`, so the resonance is sampled at exactly the resolution the memory actually operates at, and the aliasing goes away.

Give periods their own optimizer group at 5e-3, decoupled from the cosine annealing schedule.

Clamp `log_periods` at `log(2 * num_chunks)`. This one is inelegant but necessary. Without it one slot ran off to a period around 1e19, which is a slot deciding it would like to be a constant, and it does that by walking to infinity and taking the gradient norms with it.

## The Periods Move Now

After the fixes, they reorganize. Starting from a uniform log-space initialization they settle into distinct clusters: a group near 0.6, a group around 2 to 3, another around 5 to 6, then 33, then 69, and a handful pinned at the ceiling clamp.

The ceiling slots are the interesting ones. A period at the clamp means the cosine barely completes a cycle over the whole sequence, so that slot's modulation is effectively constant. The network converted them into plain persistent memory with no periodic component. That's a sensible thing to want, and I didn't build it in. It also grows over training, from zero slots at init to five or seven by convergence, which means the model is pruning itself down to roughly 25 active periodic channels out of 32.

So the mechanism works. Gradients flow, periods move, and where they land is interpretable. That's a real result and it's the one I'm most confident in.

## Where That Leaves the Numbers

Badly, is where.

On the corrected codebase at `chunk_size=7`, sequential MNIST:

| Config | Sequential MNIST |
|---|---|
| Full HMN, period-lr 5e-3 | 97.85% (ep 67) |
| Full HMN, period-lr 3e-3 | 97.59% (ep 94) |
| No-resonance | 97.65% (ep 59, still climbing) |

A 0.2 point gap over the ablation, single seed, on a task where LSTM-class models are already at ceiling, against a baseline that hadn't finished improving. That is not a result. That is a coin flip with a table around it.

And the run that would actually mean something, full HMN on permuted with working periods, never finished. That's exactly where this stopped in March.

So the honest scorecard:

- Every number that supports the hypothesis was produced with the mechanism broken.
- Every run with the mechanism working is either at ceiling (no signal) or unfinished.
- n=1 everywhere. No seeds, no error bars, no variance estimate.
- There's a codebase discontinuity on March 6, before which runs used a hand-rolled Python `LSTMCell` and after which they use cuDNN through `nn.LSTM`. Numbers across that line aren't directly comparable, and some of the ones above straddle it.
- The strongest finding in the project, chunking as regularization, has nothing to do with the hypothesis I set out to test.

I want to be clear that the mechanism being real and the mechanism being *useful* are separate claims, and right now I've only demonstrated the first one.

## MNIST Was the Wrong Benchmark

The deeper problem is that I picked the benchmark for its literature position instead of for whether it could test my hypothesis.

Sequential MNIST has no periodic structure. It's a raster scan, so there's a 28-pixel row rhythm and that's about it. Permuted MNIST has a fixed random permutation applied to all images, which means there's a consistent positional structure to exploit but it is arbitrary and definitely not periodic.

If your architecture's contribution is discovering multi-scale periodicity, and you evaluate it on data with essentially no multi-scale periodicity, the best possible outcome is that the mechanism does no harm. Which, at 97.85% versus 97.65%, is roughly what happened. There was never much room to see the effect here, and no amount of additional MNIST runs is going to change that.

## Next Steps

Finish the grid first, because unfinished runs aren't a story:

1. Full HMN on permuted, corrected codebase. This is the single most important missing number.
2. Baseline and no-resonance on the same chunk size and codebase so the comparison is clean.
3. Three or four seeds across all eight configs. Without variance I can't tell a 0.2 point gap from nothing, and I currently suspect it is nothing.

Then move to MIDI. Music is periodic at multiple nested scales simultaneously, and those scales are labeled: beat, measure, phrase, section. If the period parameters converge near the actual measure length of the training corpus, that's a claim with teeth, and it's falsifiable in a way that a 0.2 point accuracy delta on MNIST never will be. It also turns the interpretability finding from "the slots clustered at 33" into "the slots found the measure."

The MNIST work stays in the writeup as a proof of concept that the mechanism trains and does something legible. It's not going to be the headline.
