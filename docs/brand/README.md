# Inquest identity

## The mark

A hexagon around a lowercase **i** whose stem runs into a **plumb bob**.

| Element | Meaning |
| --- | --- |
| **Hexagon** | The jury: six points that must agree. It is also the figure in the homepage illustration, so the mark and the art are one vocabulary. |
| **Anchor dot** | The fixed point a plumb line hangs from: the frozen rubric. It is also the tittle of the **i** in *Inquest*. |
| **Stem and bob** | A plumb line and its weight: the oldest instrument for checking what is truly vertical. Evidence is measured against a fixed reference, not asserted. This is the product's one idea: *a bug isn't real until it repros.* |

It is deliberately not a shield, a padlock, a checkmark or a bug. Those are the first things every security product reaches for.

## Files

| File | Use |
| --- | --- |
| `mark.svg` | On light surfaces: ink outline and stem, gold dot and bob |
| `mark-reverse.svg` | On dark surfaces: ivory outline and stem, gold dot and bob |
| `favicon.svg` | Tab, app and touch icons: solid gold hexagon with the glyph knocked out in near-black |

The favicon is **optically sized**: its stem, dot and bob are heavier than in the full mark, because at 16px the full-weight glyph's thin stem disappears. PNGs (16, 32, 180, 192, 512) and the web manifest are generated from `web/brand/` by `web/scripts/make-icons.mjs`.

## Lockup

Mark plus the wordmark **Inquest**, set in Instrument Serif regular, natural case, tracking -1%. At a 28px mark the wordmark is 27px with a 10px gap. The editorial serif is the identity's second signature; the monospaced eyebrow text (`THE ON-CHAIN BUG BOUNTY PROTOCOL`) is the third.

## Colour

| Token | Hex | Role |
| --- | --- | --- |
| Inquest gold | `#D6A844` | Dot, bob, favicon field. The only brand colour |
| Gold, deep | `#8A6210` | Gold text on ivory (the standard gold is about 2:1 there) |
| Ink | `#171713` | Mark on light surfaces |
| Ivory | `#F3F0E7` | Editorial surfaces |
| Near-black | `#090A09` | Application surfaces and the favicon glyph |

## Rules

- Keep clear space of at least the hexagon's stroke width times four on every side.
- Minimum size: 16px (use `favicon.svg`); the full mark from 24px.
- Do not recolour the bob, rotate the mark, add a glow or outline the wordmark.
- Gold is the only accent. Never place the gold mark on ivory without the ink outline.
