# tinyparse 2.3.1: null pointer dereference in tp_apply_patch

## Summary

`tp_apply_patch()` in `src/patch.c` dereferences a pointer that can be NULL. The cause: patch_hunk() returns NULL when idx equals the hunk count, so hunk->data is read from address zero. A crafted input with a hunk index equal to the number of hunks makes the
library crash with a segmentation fault.

## Affected code

`src/patch.c`:

```c
hunk = patch_hunk(p, idx); apply(hunk->data, hunk->len);   /* BUG: the returned pointer is never checked */
```

## Reproduction

Built with `-fsanitize=address`, tinyparse 2.3.1, x86-64 Linux.

```sh
printf 'TP\x08\x00\x05\x00' > hunk-index.bin
./demo hunk-index.bin
```

Observed output:

```
==4008==ERROR: AddressSanitizer: SEGV on unknown address 0x000000000000 (pc 0x55d1c0a30008)
The signal is caused by a READ memory access.
Hint: address points to the zero page.
    #0 tp_apply_patch src/patch.c:48
    #1 main demo.c:31
```

## Root cause

patch_hunk() returns NULL when idx equals the hunk count, so hunk->data is read from address zero; there is no NULL check between the lookup and the use. This is a different code path
from the other parser bugs: the faulty lookup is specific to `tp_apply_patch`.

## Impact

A single crafted file crashes any program that parses it. It is a null pointer dereference: it cannot be used to read or
write other memory, so it is a crash on crafted input (low).

## Suggested fix

Check the returned pointer and return an error code when it is NULL.
