# Inquest

**A bug isn't real until it repros.**

Inquest is a GenLayer app that pays a bug bounty only when a jury of validators agrees that a **public writeup** proves an **in-scope, non-duplicate** bug.

A project locks GEN and a frozen rubric. A researcher submits one public https URL plus a bond. Each validator fetches the page itself and answers one fixed schema of five fields. A plain table then pays, slashes or refunds. If the jury cannot decide, no GEN moves.

> **Inquest does not run exploits and does not certify that software is secure.** It reads one public writeup. It never executes a proof of concept, never follows links found inside a writeup, and never sends traffic to a target. It is not legal advice, a security warranty, or permission to attack anything.

## How it works

```
project --create_bounty(rubric, payouts, bond) + GEN pool--> Inquest contract
researcher --submit_claim(url) + bond--> PENDING claim            (no judging here)
anyone --resolve_claim(id)--> validators fetch the page themselves, answer five fields
                             --> deterministic table --> GEN moves ON FINALIZATION
```

The only judgment (the whole schema):

```json
{ "evidence_available": false, "demonstrated": false, "in_scope": false, "duplicate_of": null, "severity": "none" }
```

Normalization happens in ordinary code before consensus is compared: no evidence forces everything false/none; not demonstrated, out of scope or duplicate forces severity `none`; `duplicate_of` must be `null` or an already accepted claim id on the same bounty, otherwise the result is invalid. Validators accept the leader **only when all five normalized fields equal their own independent result**. Prose is never compared.

| Normalized result | Pool | Bond |
| --- | --- | --- |
| Evidence unavailable (dead URL, login wall, not a writeup) | unchanged | returned |
| Not demonstrated, or out of scope | unchanged | slashed to the project |
| Duplicate of an accepted claim | unchanged | returned |
| Demonstrated, in scope, not a duplicate, severity low / medium / high | pays that band's absolute amount (capped by the remaining pool) | returned |

The judge may read only: the frozen rubric, the submitted URL, and up to the 8 most recent accepted claim URLs on that bounty (12,000 / 4,000 characters). It never fetches the repo or any link inside a page. Page text is placed in delimited blocks and declared untrusted data in the prompt.

### Money safety

- Every GEN movement is `emit_transfer(..., on="finalized")`: nothing leaves the contract on a provisional accept. A protocol appeal that overturns a round discards that round's messages.
- `resolve_claim` flips the claim to `RESOLVED` before anything else; a second call fails with `already resolved`. Payout is capped by the remaining pool.
- There is no admin, no moderator, no rubric edit, no payout change, and no `appeal` method. A wrong jury is a **protocol appeal** (`canAppeal`, appeal charge, `appealTransaction` on the resolve transaction); the claim page shows the window, the charge and the button.
- `withdraw` (slashed bonds plus leftover pool) works for the project only after the deadline, or when the bounty is depleted or cancelled, and only with zero claims waiting.

### Choices the spec left open (flagged, easy to change)

- A claim that is **demonstrated, in scope, not a duplicate, but under the lowest severity bar** (`severity: none`) pays nothing and **returns** the bond: the report is real, just below the rubric. The spec's table has no row for it.
- Claim URLs and `repo_url` must be a DNS name with no port or credentials; raw IPs (which covers `169.254.x.x`), `localhost`, `.local`, `.internal` are refused. This is stricter than the spec.
- A model that **omits `duplicate_of`** is read as `null` (observed on Studionet); any other missing field makes its answer invalid. Extra prose keys are dropped, never compared. A *leader result* with extra keys is rejected.
- `withdrawable` / `get_ledger` are computed from the datetime the node supplies to a view call, which may lag the chain. `withdraw` re-checks every condition at transaction time, so a stale view can only show a wrong button, never move GEN.

## Layout

```
contracts/inquest.py        the Intelligent Contract
tests/direct/               Direct Mode tests (96) - run without a network
web/                        Vite + React + TypeScript + genlayer-js app (Studionet)
web/scripts/                deploy.mjs, smoke.mjs (live), plus small debugging helpers
```

## Run it

```bash
# contract tests (Windows needs the optional loader plugin)
pip install -r requirements.txt
PYTHONPATH=scripts python -m pytest -p windows_direct_plugin     # or plain `pytest` on Linux/macOS
genvm-lint check contracts/inquest.py

# deploy to Studionet (gasless throwaway key) and write web/.env.local
cd web && npm install && node scripts/deploy.mjs

# live end-to-end smoke test against a deployed address
node scripts/smoke.mjs 0x...

# app
npm run dev          # http://localhost:5173, set VITE_CONTRACT_ADDRESS in web/.env.local
npm run build && npm test
```

The app uses an EIP-1193 wallet (MetaMask) on Studionet. Amounts are native GEN; the UI converts to wei.

**genlayer-js version:** the app pins `genlayer-js@1.1.8`. The `2.0.0-rc.1` release candidate (which adds `getAppealCharge` and `estimateTransactionFeesForWrite`) was tried first and **cannot read from or deploy to the live Studionet** (reads hit the receive handler, a deploy ended `NO_MAJORITY` with no validators). `web/src/lib/chain.ts` feature-detects both 2.x calls and falls back to `getMinAppealBond` and SDK-default fees, so it upgrades when Studionet does.

## Test status

Spec tests (Direct Mode, `tests/direct/test_inquest.py`):

| # | Case | Status |
| --- | --- | --- |
| 1 | Injection page cannot move the pool; bond slashed; never high | pass |
| 2 | In-scope high pays high, returns bond | pass |
| 3 | Borderline severity pays the lower band | pass |
| 4 | Out of scope slashes | pass |
| 5 | Duplicate returns bond, "novel" claim ignored | pass |
| 6 | Same symptom, different cause is paid | pass |
| 7 | Dead URL returns bond, never slashes; unanimous, no model call | pass |
| 8 | Different wording, same five fields: consensus accepts | pass |
| 9 | Field mismatch (low vs high, any single field): validator rejects | pass |
| 10 | Pool of one high payout depletes; slashed bond still withdrawable | pass |
| 11 | Cancel returns pool; cancel after a claim fails | pass |
| 12 | Deadline: late submit fails; withdraw with a pending claim fails | pass |
| 13 | Appeal safety | **partial**: no double resolve, all transfers `finalized`, an overturned round leaves no payout (simulated by snapshot/revert) |
| 14 | Link trap: only the claim URL and prior accepted URLs are ever requested | pass |

`genvm-lint` passes. Live on Studionet (`web/scripts/smoke.mjs`): create, submit and resolve ran end to end against real validators. A page that is not a writeup and a dead URL both resolved to `evidence_available: false` with the bond returned. A long, borderline real writeup ended **UNDETERMINED** (validators disagreed on the five fields) so nothing moved and the claim stayed pending, which is the intended fail-safe.

### Not verified

- **A live payout.** No live claim has yet earned a payout, so the finalized transfer to a researcher has not been observed on Studionet. Direct Mode only proves the transfer is scheduled with `on="finalized"`.
- **A live protocol appeal** (spec test 13 in Studio) was not run, and the Appeal button is untested against a real appealable transaction.
- **The web UI has been typechecked and built but not driven in a browser** with a wallet.
- Studionet does not credit ordinary accounts on `emit_transfer`, so payouts are visible in the contract's state and balance, not in a researcher's wallet balance.

## Known limits

- Requiring all five fields to match makes borderline writeups likely to end UNDETERMINED. That is by design (no consensus, no money), but it costs liveness. Short, concrete writeups with a clear reproduction agree most often.
- `list_claims` scans all claims (fine at hackathon scale, 40 claims per bounty); the resolve transaction id is remembered per browser, so on another device paste it to check the appeal window.
