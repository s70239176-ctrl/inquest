# Inquest: hackathon submission

**One line.** A bug bounty that pays only when a GenLayer jury agrees a public writeup proves an in-scope, non-duplicate bug. No admin key, no moderator, no backend model.

**Live app.** https://inquest-repro.vercel.app/  
**Repository.** https://github.com/s70239176-ctrl/inquest  
**Network.** GenLayer Studionet (chain id 61999)  
**Contract.** [`0xb65Ff1E3F4DDE55fF56d3A5ee98f51aDB7944630`](https://explorer-studio.genlayer.com/address/0xb65Ff1E3F4DDE55fF56d3A5ee98f51aDB7944630) on the GenLayer Studio Explorer, deployed by [`0x6e759e8f…9935384e`](https://explorer-studio.genlayer.com/tx/0x6e759e8f45c53ce64df08ec3b20ddfb25bbe42fdbd642ba84f8da07a9935384e).  
**Live test run.** `web/e2e/live.mjs` deploys a fresh contract on every run; the address and every transaction hash of the last verified run are in [docs/E2E-REPORT.md](docs/E2E-REPORT.md).
**Review response.** [docs/STEWARD-RESPONSE.md](docs/STEWARD-RESPONSE.md) answers the steward review point by point and lists what is not demonstrated.

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
- **A copier can't beat the original.** Claims are judged in submission order, so a later copy is never adjudicated, or paid, before the report it copied. Verified live: judging the copier first is refused, then the copier is judged a duplicate of the original.
- **Duplicates are checked against the whole history.** Every accepted finding on the bounty is shown to the jury (at most 12 are ever paid). Verified live: a restatement of the oldest of ten accepted reports is caught.
- **Evidence is committed.** The researcher commits to a fingerprint of the page. A page edited after filing is slashed without asking the model; a page that stays unreachable across spaced retries counts as withdrawn (slashed), while a short outage costs nothing. Verified live.
- **Nothing is stuck.** A claim the jury never settles can be expired by anyone (bond returned); the project's withdrawal keeps a reserve for pending claims, which are still paid in full. Verified live.

## What is verified, and how

| Layer | Evidence |
| --- | --- |
| Contract | `genvm-lint` passes; 116 Direct Mode tests (settlement table, precedence in every order, duplicates beyond an eight-report window, evidence commitments, retries, expiry, withdraw reserve, failed-payment recovery) |
| Live, Studionet | `web/e2e/live.mjs`: real validators, real fetches of public fixtures, GEN verified via the contract balance and contract-state readbacks: **44 pass, 1 not demonstrated, 0 fail**. Report with transaction hashes: [docs/E2E-REPORT.md](docs/E2E-REPORT.md) |
| Recipient balances | `web/e2e/contract-wallet.mjs`: reward, bond refund, cancellation and withdrawal land in a contract wallet's own balance: **6/6**. [docs/WALLET-DELIVERY-studionet-contract-wallets.md](docs/WALLET-DELIVERY-studionet-contract-wallets.md) |
| Web | typecheck, 48 unit tests (including Python/JS fingerprint parity), production build; driven end to end in a browser against live Studionet (fingerprint, file, resolve, payout) with the built-in demo account |

## Honest limits

- **Delivery to an externally-owned account is not demonstrated.** Studionet does not credit EOAs from contract-emitted transfers; the same payment paths are shown reaching contract wallets, and `web/e2e/wallet-delivery.mjs` is ready to prove the EOA case on a funded testnet account. **MetaMask-driven transactions were not performed** ([docs/METAMASK-CHECKLIST.md](docs/METAMASK-CHECKLIST.md)).
- **Protocol appeals cannot be filed on Studionet from the browser SDK** (no appeals contract in its chain config, and the node rejects `submitAppeal`). The UI shows the appeal window and withholds the button there; the same panel shows the charge and the button where the network supports it. The live suite records this as a skipped, platform-limited check. Re-execution safety is covered by the finalization-only transfers, the idempotent `resolve_claim`, and an offline snapshot/revert test.
- Requiring all five fields to match means long or borderline writeups often end UNDETERMINED (nothing moves; resolve again). That is the intended fail-safe, at a cost in liveness.
- Studionet only; `genlayer-js` 1.1.8 is pinned because the 2.0 release candidate cannot read from or deploy to the live Studionet.

## Try it in two minutes

1. `cd web && npm install && node --experimental-strip-types scripts/deploy.mjs && npm run dev`
2. Open http://localhost:5173, **Use demo account**, **Create** → *Fill with an example* → lock the pool.
3. **Reset** for a second account, open the bounty, submit a fixture URL from `fixtures/tinyparse/`, then **Resolve** and watch the verdict, the provisional timeline and the finalized payout.

Full walkthrough: [docs/DEMO.md](docs/DEMO.md). Design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
