# Harmonic Memory Networks

An LSTM with an external memory bank where every slot learns its own period. The mechanism works, but the results have not proven groundbreaking. This project served as more of a learning experience for myself, using Claude Opus to learn good research practices while getting hands-on experience with custom model implementations in PyTorch.

Up front, so that nobody has to wait around for it: for most of the life of this project the period parameters were not actually learning anything at all, and I did not catch it for quite a while. The numbers that look good were produced before I found that out, and the numbers I produced after fixing it are mostly inconclusive. I think the diagnosis is the more interesting half of this writeup anyway, so I would rather put it at the top than build up to it.

## Background

Standard attention over an external memory bank is content-based. You project the controller's hidden state into a query, dot it against a bank of keys, softmax, and read out a weighted sum of values.

It stands to reason that time-based addressing could be of value here, especially in tasks like MNIST recognition where there is a repetitive grid structure inherent to the pixel data. Signals such as "slot 7 is the one that matters every 33 steps" should prove to be useful.

So I gave each slot a period. Every memory slot `i` gets a trainable parameter `p_i`, and its content-based attention weight gets multiplied by `(1 + beta_i * cos(2*pi*t / p_i))` at step `t`. The idea is that the network can learn a set of clocks running at different rates, and slots can specialize to temporal scales instead of only to content. A slot with a short period fires constantly, and a slot with a period longer than the sequence never really oscillates at all and just acts as persistent storage.

I called it the Harmonic Memory Network, a work in progress.

As far as I can tell the combination is actually new. NTM and DNC have content-based and location-based addressing but no learnable periodicity, Legendre Memory Units use a fixed orthogonal basis rather than learned frequencies, and oscillatory RNNs put the oscillation in the hidden state dynamics instead of in the memory addressing. Transformers have learned positional encodings, but those sit on the input representation and not on which memory slot the model is allowed to touch.

## Architecture

- LSTM controller, hidden size 256
- External memory bank, 32 slots, 128-dim key and 128-dim value per slot
- Content-based attention, then harmonic modulation applied on top of the resulting weights
- Linear classifier head on the final hidden state

The benchmark is pixel-by-pixel Sequential MNIST and Permuted Sequential MNIST, 784 timesteps with an input size of 1. It is the standard long-range memory benchmark in the recurrent literature, which is more or less the only reason I picked it, and I think that turned out to be the wrong reason for choosing a benchmark.

Three configs across two tasks, which gives a reasonably clean ablation grid:

1. **Vanilla LSTM baseline**: no memory bank at all
2. **No-resonance HMN**: memory bank with content addressing only, resonance disabled
3. **Full HMN**: memory bank plus harmonic modulation

The gap between 2 and 3 is really the only thing being tested here, and the baseline is included mostly to confirm that the memory bank is contributing anything at all.

Training used AdamW at lr 1e-4 with a batch size of 256, cosine annealing, gradient clipping at 1.0, early stopping with patience 15 after a 20 epoch warmup, and a cap of 200 epochs. All of this ran on a single GPU with 32GB of VRAM. A learning rate of 1e-3 produced literally zero learning, which I assume is gradient instability accumulating over a 784-step BPTT chain, though I did not investigate that very far once 1e-4 started working.

## The Decoupling Bug

In the first real implementation the memory loop and the LSTM were not interleaved at all. The memory read and write loop ran from start to finish with `h` as zeros, and then the batched LSTM ran afterward over the whole sequence. The memory never saw a single real hidden state, and it was reading and writing against a zero vector for all 784 steps while the LSTM quietly did the classification by itself.

NOTE: The genuinely annoying part is that it trained fine. Loss went down, accuracy went up, and nothing crashed or produced a warning. I had already collected results from a handful of full runs before I noticed that the architecture I was benchmarking was not the architecture I thought I had built. It was fixed by properly interleaving the read and write with the controller steps, but everything from before that point had to be thrown out.

## Chunking

The per-pixel version does 784 Python-level `LSTMCell` iterations with a memory access at every single one, which came out to 309 seconds per epoch. That is slow enough that running one complete ablation grid eats an entire weekend. I swapped `LSTMCell` for `nn.LSTM` to let cuDNN handle a whole chunk of pixels in one fused call, and only touched memory at the chunk boundaries. At `chunk_size=8` that works out to 98 memory accesses instead of 784, and the epoch time dropped to 52 seconds.

What I did not expect was that it also changed the results:

| Config | chunk_size=1 | chunk_size=8 | Delta |
|---|---|---|---|
| No-resonance, sequential | 96.86% | 97.57% | +0.71 |
| No-resonance, permuted | 76.85% | 91.29% | +14.44 |
| Full HMN, permuted | diverged (NaN / 38%) | 93.52% | recovered |

Fourteen points on permuted is a large enough jump that I do not think it can be attributed to noise, and the full HMN config that had previously diverged to NaN at epoch 11 now trains all the way to convergence.

My read is that chunking is probably acting as regularization rather than purely as an optimization. It cuts the effective BPTT depth through the memory loop by a factor of eight, and it forces a division of labor where the LSTM handles local sequential structure inside a chunk and the memory bank only gets to participate in structure that spans chunks. The read vector goes stale inside a chunk, and I think that staleness is doing something useful here, though I would want more seeds before I would say that with any real confidence.

The 76.85% number is the one I find most interesting. Content-based memory access at every pixel actively hurt on permuted MNIST, and hurt badly, which I believe is because the memory was exploiting raster-scan locality on sequential MNIST and then found itself with a mechanism that had become a liability once the permutation destroyed that locality. In a proper study I would test that directly by permuting at a few different granularities, but I never got around to it.

## What the Numbers Looked Like at That Point

At this stage the permuted results lined up more or less the way I was hoping they would:

| Config | Permuted MNIST |
|---|---|
| Vanilla LSTM | 89.38% |
| No-resonance HMN | 91.29% |
| Full HMN | 93.52% |

Memory beat no memory by about two points, resonance beat no resonance by roughly another two, and the ordering was exactly what the hypothesis predicted. I was encouraged enough by this to start sketching out a paper outline, which in hindsight was quite premature.

## The Period Parameters Were Not Learning

I had been logging period statistics on every epoch, mostly as a sanity check that I never expected to actually look at. Minimum, maximum, mean, and standard deviation, all four of them plotted per run.

Every one of those plots was a flat horizontal line. The mean sat at roughly 117 for the entire run, and it was the same value across chunk sizes, the same value across seeds, and the same value at epoch 1 as it was at epoch 90. That figure of 117 happens to be approximately the mean of the log-uniform distribution I was initializing the periods from. The periods were sitting exactly where they had been initialized and were not moving at all.

So the harmonic component of the Harmonic Memory Network had been operating as a fixed random positional encoding for the entire project. Every number in the tables above was produced by a mechanism that was not doing the thing I was claiming it did. I think the 93.52% is probably still a real effect in the narrow sense that random multi-scale periodic modulation might genuinely help, but it is not evidence for learnable periods, and learnable periods are the whole contribution.

Printing the gradient norms on the period parameters confirmed it. They were coming back somewhere between 1e-6 and 5e-4, which is orders of magnitude below everything else in the model, so I do not think the optimizer was ever going to move them anywhere meaningful.

## Three Compounding Causes

**Aliasing.** The resonance was being computed over pixel indices 0 through 783, but with chunking enabled only the values falling on chunk boundaries are ever actually used. At `chunk_size=28` the 28 sampled resonance values are spaced 28 pixels apart, which means anything with a period shorter than 56 pixels is aliased. Roughly half of the initialized periods fell into that regime, and they were producing gradient signal that probably amounted to noise.

**The derivative itself.** For a linear period parameterization the derivative works out to:

```
d/dp cos(2*pi*t/p) = sin(2*pi*t/p) * (2*pi*t / p^2)
```

That `1/p^2` term suppresses the gradient badly for large periods, and the `sin` term changes sign across timesteps so that contributions partially cancel each other out when summed over the sequence. A slot that was initialized at a period of 400 was probably never going to move regardless of how long I trained it.

**Learning rate.** The periods were sharing the main optimizer at a 0.1x multiplier, which put them at 1e-5 against a base rate of 1e-4, and then cosine annealing drove that effective rate toward zero over the course of training. Very small gradients multiplied by a decaying and already very small learning rate puts you somewhere around the noise floor of float32.

I think any one of these on its own would probably have been survivable, but all three of them stacked together meant the parameter was effectively frozen by construction, and I spent close to two weeks convinced the problem was a bug in my logging code rather than in the model.

## The Fixes

The main change was reparameterizing into log space so that the optimizer works on `log_periods` and the actual period is recovered with `exp`, which turns the `1/p^2` suppression into something much better behaved across scales, since a fixed step in log space is a proportional step in the period itself.

```python
# stored parameter is log-space
self.log_periods = nn.Parameter(torch.log(init_periods))

# forward
periods = torch.exp(self.log_periods)
resonance = torch.cos(2 * math.pi * chunk_idx / periods)
attn = content_attn * (1 + self.beta * resonance)
```

Alongside that, the resonance is now computed in chunk-step space rather than pixel space. The `chunk_idx` runs from 0 to 97 at `chunk_size=8`, so the resonance ends up sampled at exactly the resolution the memory actually operates at and the aliasing problem goes away entirely. The periods also got their own optimizer group at 5e-3, decoupled from the cosine annealing schedule so that the rate does not decay out from under them.

Finally, `log_periods` is clamped at `log(2 * num_chunks)`. This one is inelegant and I am not especially happy with it, but without the clamp one slot ran off to a period of around 1e19, which I believe is the network trying to turn that slot into a constant, and it took the gradient norms with it on the way.

## Period Behavior After the Fixes

The periods do reorganize now. Starting from a uniform log-space initialization they settle into fairly distinct clusters, with a group near 0.6, a group around 2 to 3, another around 5 to 6, then individual slots landing near 33 and 69, and a handful sitting at the ceiling clamp.

The slots at the ceiling are the ones I find most interesting. A period sitting at the clamp means the cosine barely completes a full cycle over the whole sequence, so the modulation on that slot is effectively constant and the network has converted it into plain persistent memory with no periodic component at all. That seems like a sensible thing for the model to want, and it is not something I built in deliberately. The count also grows over training, going from zero slots at initialization to somewhere between five and seven by convergence, which I would interpret as the model pruning itself down to roughly 25 active periodic channels out of the 32 available.

So the mechanism does work in the sense that gradients flow, the periods move, and where they end up is at least legible. That is the result I am most confident in, although I would point out that "the parameter is capable of changing" is a fairly low bar to have spent several months clearing.

## Where That Leaves the Numbers

Not in a particularly good place. On the corrected codebase at `chunk_size=7`, running sequential MNIST:

| Config | Sequential MNIST |
|---|---|
| Full HMN, period-lr 5e-3 | 97.85% (ep 67) |
| Full HMN, period-lr 3e-3 | 97.59% (ep 94) |
| No-resonance | 97.65% (ep 59, still climbing) |

A 0.2 point gap on a single seed does not tell us much of anything, especially considering that the no-resonance run had not finished improving when it stopped. LSTM-class models are already fairly close to ceiling on this task, so I would not want to make any claims at all based on it.

The run that would actually mean something, which is the full HMN on permuted MNIST with the periods working properly, never finished. That is exactly where this stopped back in March.

The honest summary of the current state:

- Every number that supports the hypothesis was produced while the mechanism was broken
- Every run with the mechanism working is either sitting at ceiling with no signal available or was never completed
- There is one seed for everything, so there are no error bars and no variance estimate of any kind
- There is a codebase discontinuity on March 6, before which the runs used a hand-rolled Python `LSTMCell` and after which they use cuDNN through `nn.LSTM`, and numbers spanning that boundary are not directly comparable
- The strongest finding in the entire project is chunking as regularization, which has essentially nothing to do with the hypothesis I set out to test

The mechanism being real and the mechanism being useful are two separate claims, and I think I have only demonstrated the first one.

## MNIST Was Probably the Wrong Benchmark

The deeper problem is that I picked the benchmark based on its position in the literature rather than on whether it was capable of testing the thing I wanted to test.

Sequential MNIST does not really have periodic structure. It is a raster scan, so there is a 28-pixel row rhythm and not a great deal beyond that. Permuted MNIST applies a fixed random permutation to every image, which does leave a consistent positional structure available for the model to exploit, but that structure is arbitrary and it is certainly not periodic in any useful sense.

If the contribution of an architecture is supposed to be the discovery of multi-scale periodicity, and you evaluate it on data that contains essentially no multi-scale periodicity, then I think the best available outcome is that the mechanism does no harm. At 97.85% against 97.65% that is roughly what happened, and I do not believe additional MNIST runs are going to change that.

## Next Steps

The first priority is finishing the grid, since an unfinished grid is not really worth writing up. That means running the full HMN on permuted MNIST on the corrected codebase, which is the single most important number currently missing, then running the baseline and the no-resonance ablation at the same chunk size and on the same codebase so that the comparison is actually clean, and then sweeping three or four seeds across all eight configs. Without some variance estimate I cannot distinguish a 0.2 point gap from nothing at all, and I currently suspect it is nothing.

After that I would like to move to MIDI. Music is periodic at several nested scales at once, and those scales have names attached to them. If the period parameters converge somewhere near the actual measure length of the training corpus, then that is a claim I could test and potentially be wrong about, in a way that a 0.2 point accuracy delta on MNIST will never be. It would also turn the interpretability finding from "some slots clustered near 33" into something closer to "the slots found the measure," assuming it works at all.

The MNIST work will probably stay in as a proof of concept showing that the mechanism trains and does something legible, but I do not think it is going to be the interesting part.
