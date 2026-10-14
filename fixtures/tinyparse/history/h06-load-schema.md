# tinyparse 2.3.1: null pointer dereference in tp_load_schema

## Summary

`tp_load_schema()` in `src/schema.c` dereferences a pointer that can be NULL. The cause: schema_cache_get() returns NULL on a cache miss during the first load, then refs is incremented through it. A crafted input with a schema key that is not cached yet makes the
library crash with a segmentation fault.

## Affected code

`src/schema.c`:

```c
schema = schema_cache_get(key); schema->refs++;   /* BUG: the returned pointer is never checked */
```

## Reproduction

Built with `-fsanitize=address`, tinyparse 2.3.1, x86-64 Linux.

```sh
printf 'TP\x06\x00@x' > cold-cache.bin
./demo cold-cache.bin
```

Observed output:

```
==4006==ERROR: AddressSanitizer: SEGV on unknown address 0x000000000000 (pc 0x55d1c0a30006)
The signal is caused by a READ memory access.
Hint: address points to the zero page.
    #0 tp_load_schema src/schema.c:46
    #1 main demo.c:31
```

## Root cause

schema_cache_get() returns NULL on a cache miss during the first load, then refs is incremented through it; there is no NULL check between the lookup and the use. This is a different code path
from the other parser bugs: the faulty lookup is specific to `tp_load_schema`.

## Impact

A single crafted file crashes any program that parses it. It is a null pointer dereference: it cannot be used to read or
write other memory, so it is a crash on crafted input (low).

## Suggested fix

Check the returned pointer and return an error code when it is NULL.
