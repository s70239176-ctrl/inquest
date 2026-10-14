# tinyparse 2.3.1: null pointer dereference in tp_decode_utf8

## Summary

`tp_decode_utf8()` in `src/text.c` dereferences a pointer that can be NULL. The cause: decode_pair() returns NULL on an overlong two byte sequence and the result is written through. A crafted input with an overlong UTF-8 encoding of NUL makes the
library crash with a segmentation fault.

## Affected code

`src/text.c`:

```c
out = decode_pair(in); *out = 0;   /* BUG: the returned pointer is never checked */
```

## Reproduction

Built with `-fsanitize=address`, tinyparse 2.3.1, x86-64 Linux.

```sh
printf 'TP\x03\x00\xc0\x80' > overlong.bin
./demo overlong.bin
```

Observed output:

```
==4003==ERROR: AddressSanitizer: SEGV on unknown address 0x000000000000 (pc 0x55d1c0a30003)
The signal is caused by a READ memory access.
Hint: address points to the zero page.
    #0 tp_decode_utf8 src/text.c:43
    #1 main demo.c:31
```

## Root cause

decode_pair() returns NULL on an overlong two byte sequence and the result is written through; there is no NULL check between the lookup and the use. This is a different code path
from the other parser bugs: the faulty lookup is specific to `tp_decode_utf8`.

## Impact

A single crafted file crashes any program that parses it. It is a null pointer dereference: it cannot be used to read or
write other memory, so it is a crash on crafted input (low).

## Suggested fix

Check the returned pointer and return an error code when it is NULL.
