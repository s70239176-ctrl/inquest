# tinyparse 2.3.1: null pointer dereference in tp_parse_version

## Summary

`tp_parse_version()` in `src/version.c` dereferences a pointer that can be NULL. The cause: parse_semver() returns NULL when the string has no dot, and ver->major is read unchecked. A crafted input with a version string without a dot makes the
library crash with a segmentation fault.

## Affected code

`src/version.c`:

```c
ver = parse_semver(s); return ver->major;   /* BUG: the returned pointer is never checked */
```

## Reproduction

Built with `-fsanitize=address`, tinyparse 2.3.1, x86-64 Linux.

```sh
printf 'TP\x05\x00v7' > bare-version.bin
./demo bare-version.bin
```

Observed output:

```
==4005==ERROR: AddressSanitizer: SEGV on unknown address 0x000000000000 (pc 0x55d1c0a30005)
The signal is caused by a READ memory access.
Hint: address points to the zero page.
    #0 tp_parse_version src/version.c:45
    #1 main demo.c:31
```

## Root cause

parse_semver() returns NULL when the string has no dot, and ver->major is read unchecked; there is no NULL check between the lookup and the use. This is a different code path
from the other parser bugs: the faulty lookup is specific to `tp_parse_version`.

## Impact

A single crafted file crashes any program that parses it. It is a null pointer dereference: it cannot be used to read or
write other memory, so it is a crash on crafted input (low).

## Suggested fix

Check the returned pointer and return an error code when it is NULL.
