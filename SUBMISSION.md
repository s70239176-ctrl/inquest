# Inquest: hackathon submission

**One line.** A bug bounty that pays only when a GenLayer jury agrees a public writeup proves an in-scope, non-duplicate bug. No admin key, no moderator, no backend model.

**Repository.** https://github.com/s70239176-ctrl/inquest  
**Network.** GenLayer Studionet. A fresh contract is deployed by `web/e2e/live.mjs` on every run; the address of the last verified run is in [docs/E2E-REPORT.md](docs/E2E-REPORT.md).

## The problem

Bug bounties run on trust in a reviewer. Researchers fear an arbitrary "duplicate" or "out of scope"; projects fear paying for reports that never reproduce. Smart contracts can hold the money, but they cannot read a writeup. Inquest makes the reading verifiable: independent validators each read the same public page and must agree on five fields before any GEN moves.

## Why GenLayer is the point, not a wrapper

| Need | How Inquest uses GenLayer |
| --- | --- |
| Judge untrusted prose | `gl.vm.run_nondet_unsafe` with a leader and validators that each fetch the page (`gl.nondet.web.get`) and run their own model (`gl.nondet.exec_prompt`) |
| Agreement without trusting the leader | validators accept only when **all five normalized fields equal their own independent result**; prose is never compared |
| Settlement | an ordinary table over those five fields; GEN leaves via `emit_transfer(on="finalized")` |
| Wrong verdict | a protocol appeal, not a custom court (the contract has no `appeal` method) |

## What makes it hard to cheat

- **Hostile writeups.** Page text is fenced as untrusted data, prompt delimiters inside it are defused, and a leader that obeys an injected "answer high" produces a different five-field object from an honest validator and is rejected. Verified live with an injection fixture: never high, never paid.
- **Self-declared novelty.** A duplicate that calls itself "completely novel" is judged `duplicate_of` the earlier claim, because the judge re-reads the earlier writeup itself. Verified live.
- **Provisional is not final.** Nothing moves while a verdict is only ACCEPTED. Verified live through the contract's own balance: unchanged at ACCEPTED, reduced by exactly payout + bond at FINALIZED.
- **No stranded funds.** A raised error keeps attached GEN in the contract on this runtime (found by the first live run). The payable methods therefore never raise: a refusal returns a stable reason and refunds the exact value on finalization. Verified live.
- **No fabricated money.** A page that cannot be fetched is `evidence_available: false` and the bond is returned. The model is never asked to guess about a page that did not load.

## What is verified, and how

| Layer | Evidence |
| --- | --- |
| Contract | `genvm-lint` passes; 108 Direct Mode tests (spec cases 1-14 plus refusals, refunds, page-text handling, views) |
| Live, Studionet | `web/e2e/live.mjs`: real validators, real fetches of public fixtures, GEN verified via the contract balance. Full report with transaction hashes: [docs/E2E-REPORT.md](docs/E2E-REPORT.md) |
| Web | typecheck, 21 unit tests, production build; driven end to end in a browser against live Studionet (create, submit, resolve, finalized settlement) with the built-in demo account |

## Honest limits

- **Protocol appeals cannot be filed on Studionet from the browser SDK** (no appeals contract in its chain config, and the node rejects `submitAppeal`). The UI shows the appeal window and withholds the button there; the same panel shows the charge and the button where the network supports it. The live suite records this as a skipped, platform-limited check. Re-execution safety is covered by the finalization-only transfers, the idempotent `resolve_claim`, and an offline snapshot/revert test.
- Requiring all five fields to match means long or borderline writeups often end UNDETERMINED (nothing moves; resolve again). That is the intended fail-safe, at a cost in liveness.
- Studionet only; `genlayer-js` 1.1.8 is pinned because the 2.0 release candidate cannot read from or deploy to the live Studionet.

## Try it in two minutes

1. `cd web && npm install && node scripts/deploy.mjs && npm run dev`
2. Open http://localhost:5173, **Use demo account**, **Create** → *Fill with an example* → lock the pool.
3. **Reset** for a second account, open the bounty, submit a fixture URL from `fixtures/tinyparse/`, then **Resolve** and watch the verdict, the provisional timeline and the finalized payout.

Full walkthrough: [docs/DEMO.md](docs/DEMO.md). Design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
