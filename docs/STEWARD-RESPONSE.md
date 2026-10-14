# Response to the steward review

Each point of the review, what changed, where the evidence is, and what is **not** demonstrated. Nothing below is claimed beyond what a command in this repository produced.

| | |
| --- | --- |
| **Contract (v2)** | `0xb65Ff1E3F4DDE55fF56d3A5ee98f51aDB7944630` on Studionet, deployed with retry gap 6 h, 3 unreachable attempts, claim expiry 14 days. Deploy tx `0x6e759e8f45c53ce64df08ec3b20ddfb25bbe42fdbd642ba84f8da07a9935384e`. Seeded with one finalized example: bounty 1, claim 1, resolve tx `0xd0d3a795718d68f9f4299857aae745e199aa750848fb62aa0a906dbe50d18231` (FINALIZED, verdict high). |
| **Live suite contract** | `0x6c467DB3E69746a9D9f9fCa6d8c580FCd306b245` (short windows so retry and expiry can run in one sitting): [docs/E2E-REPORT.md](E2E-REPORT.md), **44 passed, 1 not demonstrated, 0 failed**, 54 minutes, every transaction hash listed. |
| **Contract-wallet delivery contract** | `0xF72403393A2a246c64C6aA984471d0CB2E0bA39D`: [docs/WALLET-DELIVERY-studionet-contract-wallets.md](WALLET-DELIVERY-studionet-contract-wallets.md), **6/6 delivered**. |
| **Offline suite** | `tests/direct`: **116 passed** (contract v2, mocked web and model). `web`: **48 unit tests passed**, typecheck and production build clean. |

## 1. Recipient-wallet delivery

*Asked: finalized GenVM execution, outgoing transfer results and actual wallet-balance increases for researcher rewards, bond refunds, bounty cancellations and project withdrawals.*

What exists:

- Every payment is `emit_transfer(on="finalized")`, unchanged. The live suite shows balances unchanged at `ACCEPTED` and moved at `FINALIZED` (checks 2c, 2d).
- `web/e2e/contract-wallet.mjs` runs all four paths with **smart-contract wallets** (`tests/support/proxy_wallet.py`) as project and researchers and reads each wallet's own balance before and after the finalized transfer: reward + bond refund `0 → 10100` (expected +10100), duplicate bond refund `0 → 100`, cancellation `0 → 10000`, withdrawal `10000 → 30000`; the failed-payment ledger stayed empty. Resolve transactions are `FINALIZED` in the report.
- `web/e2e/wallet-delivery.mjs` runs the same four paths with **externally-owned accounts** on a network you choose (`INQUEST_CHAIN=testnetBradbury`), reading the researcher's and project's own balances. It reports `DELIVERED` / `NOT DELIVERED` per path and writes `docs/WALLET-DELIVERY-<network>.md`.

What is **not** demonstrated:

- **Delivery to an externally-owned account has not been shown on any network.** Studionet does not credit EOAs from contract-emitted transfers: the live suite's `PAY` check records the researcher's balance staying at 0 after a finalized payout, and the contract's own balance falling by exactly the amount owed. The testnet script needs two funded accounts (about 0.6 GEN and 0.01 GEN plus fees). It has been syntax-checked, but it has **not** been run against a testnet because no funded key was available to the build.
- The contract-wallet result proves the transfers deliver finalized value to a recipient's own balance when the recipient can receive it. It is a stand-in for the EOA result, not a replacement.

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
  - **Not demonstrated live:** Studionet does not invoke this callback (the one failed transfer observed there, to an EOA, returned nothing to the contract). It is exercised only by simulating the callback in Direct Mode. Which address the callback's `sender_address` carries is taken from the SDK documentation (`self.failed_transfers.append((gl.message.sender, failed_value))`); it has not been confirmed on a network that fires it.

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
| Recipient-wallet payment verification | contract wallets: 6/6; EOA: **not demonstrated** (section 1) |
| **Complete MetaMask-driven transactions** | **Not performed.** The build tooling cannot operate a browser-extension wallet, and the live suites sign with throwaway keys. The app's wallet path shares `sendTx` with the demo-account path but has not been driven by MetaMask here. [docs/METAMASK-CHECKLIST.md](METAMASK-CHECKLIST.md) is a ten-step walkthrough, with what to record at each step, for someone with MetaMask to run. |

## Other things that remain true

- A protocol appeal still cannot be filed on Studionet (no appeals contract in the SDK's chain config; the node rejects `submitAppeal`). Appeals belong to the protocol; the contract has no appeal method.
- The jury is a model. Live outcomes can vary between runs on borderline pages. Defects exposed by earlier live runs were fixed and the suite rerun in full.
- `tests/support/proxy_wallet.py` fails `genvm-lint` (rule E013 forbids a public `__receive__`, rule E019 requires `@gl.public.write` on it: the two cannot both be satisfied). It deploys and receives on Studionet, it is test support only and is not part of the product contract, which passes lint.
