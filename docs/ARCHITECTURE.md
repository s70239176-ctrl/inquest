# Architecture

```
                         ┌────────────────────────────────────────────────────────────┐
  Researcher / Project   │  Inquest web app (Vite + React + genlayer-js)              │
  wallet or demo key ───►│  reads views, sends writes, shows verdict + appeal window  │
                         └───────────────┬────────────────────────────────────────────┘
                                         │ JSON-RPC (Studionet)
                         ┌───────────────▼────────────────────────────────────────────┐
                         │  Inquest Intelligent Contract  (contracts/inquest.py)      │
                         │                                                            │
                         │  bounties, claims, pools, ledger   ← ordinary storage      │
                         │  settlement table                  ← ordinary code         │
                         │  resolve_claim ─► gl.vm.run_nondet_unsafe(leader, validator)│
                         └───────┬──────────────────────────────┬─────────────────────┘
                                 │ each validator, independently │ emit_transfer(on="finalized")
                         ┌───────▼─────────────┐         ┌──────▼──────────────────────┐
                         │ gl.nondet.web.get   │         │ GEN leaves the contract only │
                         │ gl.nondet.exec_prompt│         │ when the verdict finalizes   │
                         └─────────────────────┘         └─────────────────────────────┘
```

## What lives where

| Concern | Where | Why |
| --- | --- | --- |
| Money, ids, limits, deadlines, bonds | contract, plain Python | Deterministic. No model is ever consulted about value. |
| "Does this writeup prove an in-scope, non-duplicate bug?" | validators, via `run_nondet_unsafe` | The only judgment. Five fields, nothing else. |
| Pay / slash / refund | contract, `decide()` | A pure function of the five normalized fields. |
| Appeal | the GenLayer protocol | The contract has no `appeal` method and no custom court. |
| Display, forms, wallet | web app | Never decides anything; sends what the contract asks for. |

## The one judgment

```json
{ "evidence_available": false, "demonstrated": false, "in_scope": false, "duplicate_of": null, "severity": "none" }
```

`normalize_judgment` (pure, deterministic) runs before consensus is compared:

1. `evidence_available == false` forces the other four fields to false / null / `none`.
2. `demonstrated == false`, `in_scope == false` or a non-null `duplicate_of` forces `severity = none`.
3. `duplicate_of` must be `null` or the id of an already accepted claim on **this** bounty; anything else makes the whole object invalid.
4. Wrong keys or wrong types make the object invalid. Invalid leader results are rejected by validators.

The validator accepts the leader **only if its own independently produced, normalized five fields are equal**. It re-fetches the page itself. Prose is never compared, and a well-formed object is never accepted on shape alone.

## Why a hostile page cannot pay itself

- The page is data, placed between `<<<SUBMITTED … SUBMITTED>>>` markers. The contract defuses `<<<` / `>>>` inside page text so a page cannot close its own block.
- The prompt states that page text, including text posing as system or developer messages, is untrusted and must be neither obeyed nor quoted.
- A leader that obeys the page produces a different five-field object from an honest validator and is rejected; with no majority, no GEN moves.
- Settlement is a table over the five fields, so even a persuasive page can only influence one of a few enumerated outcomes, and `severity` needs `demonstrated`, `in_scope` and "not a duplicate" to all hold.
- The contract fetches only the submitted URL and up to 8 earlier accepted claim URLs. It never fetches the repo or any link found in a page.

## Finality and appeals

Every transfer is `emit_transfer(value, on="finalized")`. A provisional (ACCEPTED) result moves nothing. If a protocol appeal overturns the round, the messages of the discarded round are discarded with it and the re-execution decides. `resolve_claim` sets the claim `RESOLVED` before anything else, so a re-execution of the same claim cannot pay twice.

## Storage model

`bounties: TreeMap[u256, Bounty]`, `claims: TreeMap[u256, Claim]`, per-researcher counters, monotonic ids. No page text and no model prose is stored: only the five normalized fields, the payout and the bond outcome. Duplicate checks re-read the earlier URLs.

## Known platform behaviors the design accounts for

- A transaction that ends in an execution error **keeps its attached GEN in the contract** on this runtime (measured). The UI therefore dry-runs payable calls (`simulateWriteContract`) and validates inputs client-side before any value leaves the account.
- Studionet does not credit ordinary accounts on `emit_transfer`, so the live suite proves money movement through the contract's own balance.
- `genlayer-js@2.0.0-rc.1` cannot read from or deploy to the live Studionet; the app pins 1.1.8 and feature-detects the newer calls.
