# Response to the steward review

Each point of the review, what changed, where the evidence is, and what is **not** demonstrated. Nothing below is claimed beyond what a command in this repository produced.

| | |
| --- | --- |
| **Contract (v2)** | `0x163CD9562dd603C146a6461d1C1c7655AD556fF7` on Studionet, deployed with retry gap 6 h, 3 unreachable attempts, claim expiry 14 days. Deploy tx `0x9f7a388cd7256d189dac785b599a492cdfa4c43c68689532817fe093aa43ef7e`. Seeded with one finalized example: bounty 1, claim 1, resolve tx `0x818bb761d770a92b4557afd29e6324d725f40009af8fd0bd1729f3f7055b0dc5` (FINALIZED, verdict high). |
| **Live suite contract** | `0xb2Da7DFe1417D77B858e8D9e306b646b16eA3729` (short windows so retry and expiry can run in one sitting): [docs/E2E-REPORT.md](E2E-REPORT.md), **45 passed, 0 failed**, about an hour, every transaction hash listed. |
| **Plain-wallet delivery contract** | `0xf4DD8CdA92de0850e3b0109243E32E03dd16Af47`: [docs/WALLET-DELIVERY-Genlayer-Studio-Network.md](WALLET-DELIVERY-Genlayer-Studio-Network.md), **5/5 delivered** to ordinary accounts. |
| **Offline suite** | `tests/direct`: **116 passed** (contract v2, mocked web and model). `web`: **48 unit tests passed**, typecheck and production build clean. |

## 1. Recipient-wallet delivery

*Asked: finalized GenVM execution, outgoing transfer results and actual wallet-balance increases for researcher rewards, bond refunds, bounty cancellations and project withdrawals.*

**Found and fixed.** An earlier version of this document said Studionet cannot credit ordinary accounts from contract payments. That was wrong about the cause: a normal contract message (`emit_transfer` on a contract handle) must reach a *contract*, so a payout to a plain account ended in a GenVM "Contract not found" error and was never credited. The sibling project Stagehold had already found the way round it: send through the SDK's EVM-style plain send (`gl.evm.contract_interface`), which credits any address, needs no GenVM run, and lands only when the transaction that emitted it is finalized. Inquest's single payment function (`_pay` in `contracts/inquest.py`) now uses that. Nothing else about the money logic changed.

**Evidence, on ordinary accounts (fresh throwaway keys, balances read with `eth_getBalance` before and after the finalized resolve/cancel/withdraw transaction):** `web/e2e/wallet-delivery.mjs` against Studionet, report [docs/WALLET-DELIVERY-Genlayer-Studio-Network.md](WALLET-DELIVERY-Genlayer-Studio-Network.md), **5/5 delivered**:

| Path | Recipient balance | Expected |
| --- | --- | --- |
| Researcher reward + bond refund (resolve, accepted high finding) | 0 → 0.1005 GEN | +0.1005 |
| Bond refund only (duplicate, no reward) | 0 → 0.0005 GEN | +0.0005 |
| Bounty cancellation (pool back to the project) | 0 → 0.1 GEN | +0.1 (the project paid no fee on Studionet) |
| Project withdrawal after the deadline | 0 → 0.1 GEN | +0.1 |
| Failed-payment ledger after all of the above | 0 | 0 |

Every resolve transaction in that run reached `FINALIZED`, the claim read back as `RESOLVED` with the expected payout and bond outcome, and the full live suite (`web/e2e/live.mjs`, check `PAY`) repeats the reward check: the researcher's own wallet balance read 10100 (payout + bond) after the finalized resolve.

What is **not** demonstrated: a network other than Studionet. `wallet-delivery.mjs` takes `INQUEST_CHAIN=testnetBradbury` and funded keys and was not run there (no funded key was available to the build).

## 2. Duplicate verification across the whole accepted history

- The old judge saw only the 8 most recent of up to 40 claims. Now each bounty pays at most `MAX_ACCEPTED = 12` findings; the prompt lists **every** accepted finding on the bounty, oldest first, and validators compare against all of them. There is no "latest N" window to hide behind.
- Offline: `TestFullHistory` fills a bounty with 11 accepted findings and checks that the prompt contains all 11 `PRIOR` blocks, that a duplicate of the **oldest** report is recognised, that a duplicate of each position (first, middle, last) is accepted, that the cap is enforced (`bounty_full`: no reward, bond returned) and that the prompt stays bounded.
- **Live (real validators):** a bounty accepts the high fixture plus nine distinct low findings (10 accepted, ids 12-21); a later report that restates the first one is judged `duplicate_of = 12`, payout 0, bond returned, although nine newer findings sit between them (checks H1, H2). Run once; the jury is a model, so a borderline fixture could be judged differently on another run.

## 3. Fair deterministic precedence

- `resolve_claim` only judges the oldest `PENDING` claim on a bounty; anything else reverts `resolve earlier claim first`. A copier who files after the original cannot be adjudicated, and paid, before it, whoever calls resolve and in whatever order. Different bounties are independent queues.
- Offline: copier-first is refused, original paid then copier judged duplicate, the prompt for the copier contains the original, every submit-order permutation of three researchers is enforced, third parties can trigger resolution but only in order.
- **Live:** claims 7 (original) and 8 (copier): resolving the copier first reverts with `resolve earlier claim first` (transaction `0x7a4a889c…8da9`), `head_claim_id` reads back as the original, the original is paid in full, then the copier is judged `duplicate_of` the original, no payout, bond returned (checks P0-P4).
- Trade-off, stated plainly: a stuck head claim delays the claims behind it. The delay is bounded: an unreachable page by `retry_gap × max_unavailable` (default 12 h), anything else by `claim_expiry` (default 14 days), after which anyone can expire it.

## 4. Evidence commitments, and source failure versus withdrawal

- `submit_claim(bounty_id, url, evidence_hash)`: the researcher commits to the sha256 of the cleaned page text (first 12,000 characters; markup stripped only from real HTML). The same cleaner exists in Python (`clean_page`) and TypeScript (`web/src/lib/fingerprint.ts`); 20 shared vectors in `tests/vectors/fingerprint.json` are asserted by both test suites and match, and `npm run fingerprint -- <url>` prints the commitment.
- At resolution each validator loads the page and checks it **before any model is consulted**, and `source` is part of what validators must agree on:
  - `changed` (loads, differs from the commitment): unsupported, bond slashed, no payout, the model is never asked.
  - `unavailable` (cannot be loaded): costs nothing, retried after `retry_gap`, at most `max_unavailable` times. Unreachable on every spaced attempt is treated as **withdrawn** evidence: bond slashed. So a short outage is free and taking a bad report offline earns no refund.
  - Prior accepted findings keep their fingerprints too: a rewritten prior page is shown to the jury as changed, a vanished one as unavailable, and the prompt forbids calling a duplicate without a body to compare.
- Offline: changed, swapped-for-a-better-page, short outage then recovery, retry spacing, withdrawal after the last attempt, recovered-but-different page, changed and vanished priors.
- **Live:** a committed fingerprint that does not match the page: `evidence_state = changed`, slashed (E1, E2). Unreachable page: first attempt leaves the claim `PENDING` with `attempts = 1`, an immediate retry reverts `retry too soon`, and after the gap the second unreachable result settles it `withdrawn`, slashed (E3-E5). Passing claims in the same run used fingerprints computed by the web app's code and were judged normally, which also confirms Python/JS parity against live validators.
- Limits: only the first 12,000 characters are committed and judged. A short outage that spans every retry is still treated as withdrawal; the researcher's protection is that retries are spaced.

## 5. Conservative recovery

- **Project withdrawals.** `withdraw` releases `pool − reserved + slashed`, where `reserved = min(pool, pending × high_payout)`. It can run after the deadline while claims are pending, and those claims are still paid in full. Offline: reserve equals one high payout, scales with pending claims, never exceeds the pool, drops when a claim expires. **Live (W1-W5):** reserve read back as exactly one high payout; the project withdrew exactly the unreserved 20,000 on finalization; the pending claim was then resolved and paid its full 10,000 plus bond; reserve and pool read back as 0.
- **Permanently unresolved consensus.** `expire_claim` (anyone, after `claim_expiry`): bond returned, no reward, the attempt is not counted against the researcher, the queue moves on, and an expired claim can no longer be resolved. Offline: six consecutive invalid jury answers leave the claim `PENDING` with no money moved, then expiry returns the bond. **Live (Q1-Q6):** refused before the window (`not expired yet`), a queued claim cannot jump ahead, after the window the stuck claim cannot be judged (`claim expired`), a stranger expires it and the bond is returned on finalization, the next claim becomes head and is paid.
  - Trade-off: a researcher with a valid finding who hits a permanently undeterminable jury gets their bond back and no reward; they can refile.
- **Failed payments.** `__on_errored_message__` records returned value against the recipient it could not reach; `recover_failed_payment(to)` lets that recipient collect it to any address, clearing the ledger first. Offline: recording, accumulation, recovery to another address, no double recovery, and conservation.
  - **Not demonstrated live:** Studionet does not invoke this callback (the only failed transfer ever observed there was the old contract-message payout to a plain account, which returned nothing to the contract and is no longer how payments are sent). It is exercised only by simulating the callback in Direct Mode. Which address the callback's `sender_address` carries is taken from the SDK documentation (`self.failed_transfers.append((gl.message.sender, failed_value))`); it has not been confirmed on a network that fires it.

## 6. Testing the steward asked for

| Asked | Where |
| --- | --- |
| Competing claims submitted and resolved in different orders | `TestPrecedence` (offline, all permutations); live P0-P4 |
| Duplicates beyond the eight-report window | `TestFullHistory` (offline); live H1-H2 |
| Evidence changes between submission and resolution | `TestCommitments` (offline); live E1-E5 |
| Repeated undetermined consensus | `TestExpiry.test_repeated_undetermined_consensus_ends_in_a_bond_refund`; live Q1-Q6 |
| Failed-payment recovery | `TestFailedPayments` (offline, simulated callback only) |
| Authoritative contract-state readbacks | the live suite reads `get_params`, `get_bounty` (reserved, head, accepted ids, withdrawable) and `get_claim` (evidence state, note, attempts) after every step |
| Finalized consensus results | every settling transaction is waited to `FINALIZED`; votes are recorded in the report notes |
| Source-integrity evidence | `evidence_hash`, `evidence_state`, `note` on every claim; shown in the claim page and jury card |
| Recipient-wallet payment verification | ordinary accounts on Studionet: 5/5 delivered (section 1); other networks not run |
| **Complete MetaMask-driven transactions** | **Not performed.** The build tooling cannot operate a browser-extension wallet, and the live suites sign with throwaway keys. The app's wallet path shares `sendTx` with the demo-account path but has not been driven by MetaMask here. [docs/METAMASK-CHECKLIST.md](METAMASK-CHECKLIST.md) is a ten-step walkthrough, with what to record at each step, for someone with MetaMask to run. |

## Other things that remain true

- A protocol appeal still cannot be filed on Studionet (no appeals contract in the SDK's chain config; the node rejects `submitAppeal`). Appeals belong to the protocol; the contract has no appeal method.
- The jury is a model. Live outcomes can vary between runs on borderline pages. Defects exposed by earlier live runs were fixed and the suite rerun in full.
- `tests/support/proxy_wallet.py` fails `genvm-lint` (rule E013 forbids a public `__receive__`, rule E019 requires `@gl.public.write` on it: the two cannot both be satisfied). It deploys and receives on Studionet, it is test support only and is not part of the product contract, which passes lint.
