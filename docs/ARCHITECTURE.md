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
- The contract fetches only the submitted URL and the URLs of the earlier accepted claims on the same bounty (at most 12, so that is the complete accepted history). It never fetches the repo or any link found in a page.

## Finality and appeals

Every transfer is `emit_transfer(value, on="finalized")`. A provisional (ACCEPTED) result moves nothing. If a protocol appeal overturns the round, the messages of the discarded round are discarded with it and the re-execution decides. `resolve_claim` sets the claim `RESOLVED` before anything else, so a re-execution of the same claim cannot pay twice.

## Storage model

`bounties: TreeMap[u256, Bounty]`, `claims: TreeMap[u256, Claim]`, per-researcher counters, a failed-payment ledger, monotonic ids. No page text and no model prose is stored: only the five normalized fields, the payout, the bond outcome and each claim's evidence commitment (a sha256). Duplicate checks re-read the earlier URLs.

## Refusals never strand GEN

A transaction that **raises** keeps its attached GEN inside the contract on this runtime. The first live run measured it: a refused `submit_claim` left the bond behind. So the two payable methods (`create_bounty`, `submit_claim`) never raise after value is attached. Every check runs before any write; on a refusal the method returns `{ "ok": false, "id": 0, "reason": "<stable reason>" }` and emits a refund of the exact attached value with `on="finalized"`. Successful calls return `{ "ok": true, "id": <n>, "reason": "" }`. The web app decodes that return value from the leader receipt and shows the reason in plain language. Non-payable methods (`cancel`, `resolve_claim`, `withdraw`) carry no value and still raise `gl.vm.UserError` with the stable messages.

## Known platform behaviors the design accounts for

- **Appeals.** On Studionet the SDK's chain config has no appeals contract: `canAppeal` and the charge quote are unsupported, and an `appealTransaction` is rejected by the node ("Invalid transaction data"; the SDK sends `submitAppeal` as a plain EVM call to the consensus address). The contract has no `appeal` method either way: appeals belong to the protocol. The claim page shows the window (round `ACCEPTED`, not yet `FINALIZED`), the quoted charge where the network quotes one, and the Appeal button only where the network accepts the transaction.
- Studionet does not credit ordinary accounts on `emit_transfer`, so the live suite proves money movement through the contract's own balance. Recipient-wallet delivery needs a network that does; see `docs/STEWARD-RESPONSE.md` and `web/e2e/wallet-delivery.mjs`.
- `genlayer-js@2.0.0-rc.1` cannot read from or deploy to the live Studionet; the app pins 1.1.8 and feature-detects the newer calls.
- The model often omits a `null` field; an absent `duplicate_of` is read as `null`. Any other missing field makes the answer invalid.

## Fairness and recovery rules (v2)

These exist because a duplicate-report race, an edited page and a stuck claim are the three ways a bounty can be gamed or frozen.

**Precedence is submission order.** Only the oldest `PENDING` claim on a bounty can be judged (`resolve_claim` refuses anything else with `resolve earlier claim first`). A copier who files after the original therefore cannot be adjudicated, and paid, ahead of it, whatever order anyone calls `resolve_claim` in. Different bounties are independent queues.

**The comparison window is the whole accepted history.** Each bounty pays at most `MAX_ACCEPTED = 12` findings (the 12th closes it). The jury prompt lists every accepted finding on the bounty, oldest first, and validators compare the new claim against all of them. There is no "most recent N" window to hide a duplicate behind. A finding past the cap is recorded as `bounty_full`: no reward, bond returned.

**Evidence is committed.** `submit_claim(bounty_id, url, evidence_hash)` stores the sha256 of the cleaned page text (`clean_page`, mirrored rule for rule by `web/src/lib/fingerprint.ts`; `tests/vectors/fingerprint.json` pins both implementations to the same 20 vectors). At resolution each validator fetches the page, hashes it and checks the commitment *before* any model is consulted:

| `source` | Meaning | Settlement |
| --- | --- | --- |
| `ok` | page matches its commitment | the model judges it; the five-field table applies |
| `changed` | page loads but differs from the commitment | unsupported: bond slashed, no payout, the model is never asked |
| `unavailable` | page could not be loaded | retried (spaced by `retry_gap`) up to `max_unavailable` times; each unanimous "unavailable" costs nothing; the last one is treated as withdrawn evidence and the bond is slashed |

`source` is part of what validators must agree on, together with the five fields. A short outage therefore costs a researcher nothing, and taking a bad report offline does not earn a refund. The same fingerprint is kept for accepted findings, so a prior finding that was rewritten after acceptance is shown to the jury as changed.

**Nothing can be stuck.** If the jury cannot settle a claim (repeated `UNDETERMINED`, an invalid answer, a page that never returns), anyone can call `expire_claim` once the claim has been pending for `claim_expiry`: the bond is returned, no reward is paid, the attempt is not counted against the researcher, and the queue moves on. An expired claim can no longer be resolved.

**The project cannot strand a waiting claim.** `withdraw` releases `pool - reserved + slashed`, where `reserved = min(pool, pending_claims * high_payout)`. It can run after the deadline even while claims are pending; those claims are still paid in full from the reserve.

**Failed outgoing transfers are recoverable.** If a finalized transfer cannot be delivered, the protocol hands the value back through `__on_errored_message__`. The contract records it against the recipient it could not reach (`get_failed_payment`) and the recipient can send it to any address with `recover_failed_payment`. The ledger is cleared before the transfer is emitted.

Deployment parameters (`retry_gap`, `max_unavailable`, `claim_expiry`) are constructor arguments, fixed forever. There is no admin.
