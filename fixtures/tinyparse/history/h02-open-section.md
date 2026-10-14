# tinyparse 2.3.1: null pointer dereference in tp_open_section

## Summary

`tp_open_section()` in `src/section.c` dereferences a pointer that can be NULL. The cause: find_section() returns NULL when the section id is absent and sec->count is read unchecked. A crafted input with a section id the document does not contain makes the
library crash with a segmentation fault.

## Affected code

`src/section.c`:

```c
sec = find_section(doc, id); return sec->count;   /* BUG: the returned pointer is never checked */
```

## Reproduction

Built with `-fsanitize=address`, tinyparse 2.3.1, x86-64 Linux.

```sh
printf 'TP\x02\x00\x09\x00' > missing-section.bin
./demo missing-section.bin
```

Observed output:

```
==4002==ERROR: AddressSanitizer: SEGV on unknown address 0x000000000000 (pc 0x55d1c0a30002)
The signal is caused by a READ memory access.
Hint: address points to the zero page.
    #0 tp_open_section src/section.c:42
    #1 main demo.c:31
```

## Root cause

find_section() returns NULL when the section id is absent and sec->count is read unchecked; there is no NULL check between the lookup and the use. This is a different code path
from the other parser bugs: the faulty lookup is specific to `tp_open_section`.

## Impact

A single crafted file crashes any program that parses it. It is a null pointer dereference: it cannot be used to read or
write other memory, so it is a crash on crafted input (low).

## Suggested fix

Check the returned pointer and return an error code when it is NULL.
