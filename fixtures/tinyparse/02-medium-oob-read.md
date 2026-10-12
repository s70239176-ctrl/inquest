# tinyparse 2.3.1: out-of-bounds read in parse_body when a record ends without a terminator

## Summary

`parse_body()` in `src/body.c` scans for the record terminator `\n` with a loop that checks the byte before checking
the bound. When the final record has no terminator, the loop reads one byte past the end of the input buffer and then
copies the over-read length into the returned field, leaking adjacent heap memory to the caller.

## Affected code

`src/body.c`, lines 112-128:

```c
const uint8_t *p = cur;
while (*p != '\n' && p < end) {     /* BUG: dereferences *p before testing p < end */
    p++;
}
size_t n = (size_t)(p - cur);
field->len = n;
memcpy(field->data, cur, n + 1);    /* copies the terminator byte, which is one past `end` when unterminated */
```

The condition order is reversed, and the `n + 1` copy assumes a terminator exists.

## Reproduction

Built with `-fsanitize=address`, tinyparse 2.3.1, x86-64 Linux.

```sh
printf 'TP\x04\x00NAME' > unterminated.bin     # header declares 4 bytes, body "NAME" has no trailing \n
./demo unterminated.bin
```

Observed output:

```
==5530==ERROR: AddressSanitizer: heap-buffer-overflow on address 0x602000000018
READ of size 1 at 0x602000000018 thread T0
    #0 parse_body src/body.c:114
    #1 main demo.c:22
0x602000000018 is located 0 bytes after 8-byte region [0x602000000010,0x602000000018)
```

With the allocator's redzone disabled (`ASAN_OPTIONS=detect_stack_use_after_return=0 MALLOC_PERTURB_=0` and a plain
build) the extra byte returned in `field->data[n]` is the first byte of the next heap chunk, so repeated calls on
inputs of different lengths disclose heap contents one byte per record.

## Root cause

Reversed bounds test (`*p` evaluated before `p < end`) combined with an unconditional `n + 1` copy.

## Impact

One-byte out-of-bounds read per unterminated record, returned to the caller. This discloses adjacent heap memory but
cannot write; it does not by itself give code execution.

## Suggested fix

Test `p < end` first, and copy exactly `n` bytes then write the terminator explicitly.
