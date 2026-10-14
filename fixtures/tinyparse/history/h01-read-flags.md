# tinyparse 2.3.1: null pointer dereference in tp_read_flags

## Summary

`tp_read_flags()` in `src/flags.c` dereferences a pointer that can be NULL. The cause: lookup_flag() returns NULL for an unknown flag name and the caller dereferences it. A crafted input with a flag name that is not in the table makes the
library crash with a segmentation fault.

## Affected code

`src/flags.c`:

```c
flags = lookup_flag(table, name); flags->mask |= bit;   /* BUG: the returned pointer is never checked */
```

## Reproduction

Built with `-fsanitize=address`, tinyparse 2.3.1, x86-64 Linux.

```sh
printf 'TP\x01\x00ZZZZ' > unknown-flag.bin
./demo unknown-flag.bin
```

Observed output:

```
==4001==ERROR: AddressSanitizer: SEGV on unknown address 0x000000000000 (pc 0x55d1c0a30001)
The signal is caused by a READ memory access.
Hint: address points to the zero page.
    #0 tp_read_flags src/flags.c:41
    #1 main demo.c:31
```

## Root cause

lookup_flag() returns NULL for an unknown flag name and the caller dereferences it; there is no NULL check between the lookup and the use. This is a different code path
from the other parser bugs: the faulty lookup is specific to `tp_read_flags`.

## Impact

A single crafted file crashes any program that parses it. It is a null pointer dereference: it cannot be used to read or
write other memory, so it is a crash on crafted input (low).

## Suggested fix

Check the returned pointer and return an error code when it is NULL.
