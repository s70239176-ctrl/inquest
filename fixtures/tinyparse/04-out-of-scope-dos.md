# tinyparse 2.3.1: parser is slow on very large inputs (denial of service)

## Summary

Feeding tinyparse a very large file makes it spend a long time parsing and use a lot of memory. A service that parses
uploaded files can be kept busy by a single oversized upload.

## Reproduction

```sh
head -c 3000000000 /dev/zero > huge.bin
printf 'TP\x00\x10' | cat - huge.bin > big.bin
time ./demo big.bin
```

Observed on my laptop: 41 seconds of CPU time and a peak of 5.8 GB resident memory before the process exits normally.
There is no crash, no memory corruption, and the output is correct. The cost grows linearly with input size.

## Cause

`tp_open()` reads the whole file into memory before parsing and there is no maximum input size option.

## Impact

Resource exhaustion by a very large input. An application that limits upload sizes is not affected.

## Suggested fix

Add a `TP_MAX_INPUT` limit and stream the body.
