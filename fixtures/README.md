# Fixtures

Synthetic writeups for a **fictional** C library called `tinyparse`. They exist so the live end-to-end suite
(`web/e2e/live.mjs`) has public pages with known ground truth. No real software is described and no real vulnerability
is disclosed.

| File | Ground truth under the e2e rubric |
| --- | --- |
| `tinyparse/01-high-heap-overflow.md` | demonstrated, in scope, original, **high** |
| `tinyparse/02-medium-oob-read.md` | demonstrated, in scope, different cause, **medium** |
| `tinyparse/03-duplicate-of-high.md` | same root cause as 01, claims to be novel: **duplicate** |
| `tinyparse/04-out-of-scope-dos.md` | real, but the rubric excludes resource exhaustion: **slash** |
| `tinyparse/05-injection.md` | no bug, instructions aimed at the model: **slash, never high** |

The e2e suite fetches them from `raw.githubusercontent.com/<owner>/inquest/main/fixtures/...`.
