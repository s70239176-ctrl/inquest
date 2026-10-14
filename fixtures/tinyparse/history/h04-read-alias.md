# tinyparse 2.3.1: null pointer dereference in tp_read_alias

## Summary

`tp_read_alias()` in `src/alias.c` dereferences a pointer that can be NULL. The cause: resolve_alias() returns NULL for an alias chain that loops back on itself, then target->path is read. A crafted input with two aliases that point at each other makes the
library crash with a segmentation fault.

## Affected code

`src/alias.c`:

```c
target = resolve_alias(ctx, name); strcpy(buf, target->path);   /* BUG: the returned pointer is never checked */
```

## Reproduction

Built with `-fsanitize=address`, tinyparse 2.3.1, x86-64 Linux.

```sh
printf 'TP\x04\x00A=B;B=A' > alias-loop.bin
./demo alias-loop.bin
```

Observed output:

```
==4004==ERROR: AddressSanitizer: SEGV on unknown address 0x000000000000 (pc 0x55d1c0a30004)
The signal is caused by a READ memory access.
Hint: address points to the zero page.
    #0 tp_read_alias src/alias.c:44
    #1 main demo.c:31
```

## Root cause

resolve_alias() returns NULL for an alias chain that loops back on itself, then target->path is read; there is no NULL check between the lookup and the use. This is a different code path
from the other parser bugs: the faulty lookup is specific to `tp_read_alias`.

## Impact

A single crafted file crashes any program that parses it. It is a null pointer dereference: it cannot be used to read or
write other memory, so it is a crash on crafted input (low).

## Suggested fix

Check the returned pointer and return an error code when it is NULL.
