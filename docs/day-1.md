# Problem

Find the first and last numbers in a string and concatenate them.

## Example Input

```
1abc2
pqr3stu8vwx
a1b2c3d4e5f
treb7uchet
```

# Plan

## Parse

Turn the input into a `M` \* `N` matrix, where N is a power of 2.
In terms of the input, `M` is the number of input lines and `N` is the least power of two which is larger than the longest input line.

The matrix will be represented as a single strided `Uint32Array` with stride `N`.
Each character in the input will be turned into an integer using its UTF-8 encoding.

## GPU Computation

### Buffers & Globals

1. Input buffer (`array<u32, M * N>`)
2. Combined number buffer (`array<u32, M>`)
3. Output buffer (`array<u32, M>`)

### First Parallel Reduction

Compute the first and last digits of each line in the array.
We assume that `N` is less than the maximum X-dimension for WebGPU workgroups (256).
We dispatch `M` workgroups of size `N`.

The following code performs a parallel reduction which gets the first and last digits of the given line.
