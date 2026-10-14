# tinyparse 2.3.1: null pointer dereference in tp_emit_table

## Summary

`tp_emit_table()` in `src/emit.c` dereferences a pointer that can be NULL. The cause: table_column() returns NULL for a column number larger than the declared width, and col->title is read. A crafted input with a column number larger than the table width makes the
library crash with a segmentation fault.

## Affected code

`src/emit.c`:

```c
col = table_column(t, n); fputs(col->title, out);   /* BUG: the returned pointer is never checked */
```

## Reproduction

Built with `-fsanitize=address`, tinyparse 2.3.1, x86-64 Linux.

```sh
printf 'TP\x09\x00\x20\x00' > wide-column.bin
./demo wide-column.bin
```

Observed output:

```
==4009==ERROR: AddressSanitizer: SEGV on unknown address 0x000000000000 (pc 0x55d1c0a30009)
The signal is caused by a READ memory access.
Hint: address points to the zero page.
    #0 tp_emit_table src/emit.c:49
    #1 main demo.c:31
```

## Root cause

table_column() returns NULL for a column number larger than the declared width, and col->title is read; there is no NULL check between the lookup and the use. This is a different code path
from the other parser bugs: the faulty lookup is specific to `tp_emit_table`.

## Impact

A single crafted file crashes any program that parses it. It is a null pointer dereference: it cannot be used to read or
write other memory, so it is a crash on crafted input (low).

## Suggested fix

Check the returned pointer and return an error code when it is NULL.
