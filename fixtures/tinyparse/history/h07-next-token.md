# tinyparse 2.3.1: null pointer dereference in tp_next_token

## Summary

`tp_next_token()` in `src/lexer.c` dereferences a pointer that can be NULL. The cause: lex_next() returns NULL when the input ends inside a quoted string, and tok->kind is read unchecked. A crafted input with a quoted string that never closes makes the
library crash with a segmentation fault.

## Affected code

`src/lexer.c`:

```c
tok = lex_next(lx); if (tok->kind == T_EOF) return;   /* BUG: the returned pointer is never checked */
```

## Reproduction

Built with `-fsanitize=address`, tinyparse 2.3.1, x86-64 Linux.

```sh
printf 'TP\x07\x00"abc' > unterminated-quote.bin
./demo unterminated-quote.bin
```

Observed output:

```
==4007==ERROR: AddressSanitizer: SEGV on unknown address 0x000000000000 (pc 0x55d1c0a30007)
The signal is caused by a READ memory access.
Hint: address points to the zero page.
    #0 tp_next_token src/lexer.c:47
    #1 main demo.c:31
```

## Root cause

lex_next() returns NULL when the input ends inside a quoted string, and tok->kind is read unchecked; there is no NULL check between the lookup and the use. This is a different code path
from the other parser bugs: the faulty lookup is specific to `tp_next_token`.

## Impact

A single crafted file crashes any program that parses it. It is a null pointer dereference: it cannot be used to read or
write other memory, so it is a crash on crafted input (low).

## Suggested fix

Check the returned pointer and return an error code when it is NULL.
