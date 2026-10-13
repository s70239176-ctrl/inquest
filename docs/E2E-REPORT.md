# Live end-to-end report (Studionet)

- Run: 2026-10-13T00:00:30.528Z → 2026-10-13T00:20:08.023Z (20 min)
- Contract: `0x155AD9c1cA096dB361302d2019d53CF4Ebd186d3` (deploy tx `0x0438a0e39252207b90d05740a6f4aa8e0cb044ac27e72569da2f6290726c82cb`)
- Fixtures: https://raw.githubusercontent.com/s70239176-ctrl/inquest/main/fixtures/tinyparse/
- Result: **44/45 checks passed, 1 skipped (platform limitation), 0 failed**

Nothing is mocked: validators fetched the fixture pages and ran their own models. GEN is verified through the contract's own balance (Studionet does not credit ordinary accounts).

| ID | Check | Result | Detail |
| --- | --- | --- | --- |
| D0 | contract deploys on Studionet and answers views | PASS |  |
| 12a | claim submitted before the deadline is accepted | PASS | claim 1 |
| C1 | create_bounty locks the attached pool in the contract | PASS | balance +14000 |
| C2 | frozen fields stored; status OPEN | PASS |  |
| S1 | claim submission pays nothing and creates a PENDING claim | PASS | bond locked +100 |
| 2a | in-scope high writeup is judged demonstrated/in-scope/original/high | PASS | evidence=true demonstrated=true in_scope=true dup=null severity=high payout=10000 bond=RETURNED |
| 2b | payout equals the high band and the bond is returned | PASS |  |
| 2c | NO GEN moves while the resolve tx is only ACCEPTED (provisional) | PASS | before 24200, at accept 24200 |
| 2d | GEN moves on FINALIZATION: contract balance drops by payout + returned bond | PASS | before 24200 -> after 14100 (expected 14100) |
| 2e | pool decremented and the claim is recorded as accepted | PASS | pool 4000 |
| 5a | a duplicate that calls itself novel is judged duplicate_of the earlier claim | PASS | evidence=true demonstrated=true in_scope=true dup=2 severity=none payout=0 bond=RETURNED |
| 5b | duplicate: no payout, bond returned | PASS |  |
| 5c | duplicate: pool unchanged | PASS |  |
| 6a | same area, different cause: not a duplicate, demonstrated and in scope | PASS | evidence=true demonstrated=true in_scope=true dup=null severity=medium payout=3000 bond=RETURNED |
| 3a | out-of-bounds READ clears the medium bar and is paid medium (not high) | PASS | evidence=true demonstrated=true in_scope=true dup=null severity=medium payout=3000 bond=RETURNED |
| 4a | real but excluded (DoS) is judged out of scope, no payout | PASS | evidence=true demonstrated=true in_scope=false dup=null severity=none payout=0 bond=SLASHED |
| 4b | out of scope: bond slashed to the project ledger | PASS |  |
| 1a | injection page: never high, never paid | PASS | evidence=false demonstrated=false in_scope=false dup=null severity=none payout=0 bond=RETURNED |
| 1b | injection page: settled by the table (not-evidence -> bond returned, or not-demonstrated -> bond slashed) | PASS | bond=RETURNED evidence=false |
| 1c | pool after A (high) and C (medium) is exactly 14000-10000-3000 | PASS | pool 1000 |
| 7a | dead URL: evidence_available false, fields forced empty | PASS | evidence=false demonstrated=false in_scope=false dup=null severity=none payout=0 bond=RETURNED |
| 7b | dead URL: bond returned, never slashed | PASS |  |
| R1 | a second claim while one is pending is refused with 'pending exists' | PASS | revert=pending exists |
| R2 | http:// URL refused with 'bad url' | PASS | revert=bad url |
| R3 | a refused claim returns the attached bond to the researcher (soft refusal, refunded on finalization) | PASS | contract balance change after finalization 0 |
| R4 | the refused claim left no trace in the bounty (claim count unchanged) | PASS | claim_count 7 |
| R5 | a refused create_bounty returns the whole pool and creates nothing | PASS | reason=bad rubric; balance 11200 -> 11200 |
| W1 | withdraw before the deadline is refused ('nothing to withdraw') | PASS | revert=nothing to withdraw |
| X1 | cancel after claims exist is refused ('has claims') | PASS | revert=has claims |
| W2 | only the project can withdraw ('not project') | PASS | revert=not project |
| 13a | the round is provisional while ACCEPTED: the bond has not moved yet | PASS | balance 21300 -> 21300 at ACCEPTED |
| 13b | a protocol appeal can be filed while the round is ACCEPTED | SKIP | platform limitation, not exercised: error:Invalid parameters were provided to the RPC method. Double check you have provided the correct parameters. |
| 13c | after finalization the claim is resolved ONCE and the bond is paid back exactly once | PASS | evidence=false demonstrated=false in_scope=false dup=null severity=none payout=0 bond=RETURNED; tx FINALIZED; balance 21300 -> 21200 |
| 13d | re-resolving a settled claim is refused and moves nothing | PASS | revert=already resolved |
| 10a | pool equal to one high payout is emptied by one high finding -> DEPLETED | PASS | evidence=true demonstrated=true in_scope=true dup=null severity=high payout=10000 bond=RETURNED; status DEPLETED |
| 10b | a new claim on a depleted bounty is refused ('not open') | PASS | revert=not open |
| 10c | slashed bond is withdrawable after depletion (ledger == bond) | PASS | ledger 100 |
| 10d | withdraw pays the slashed bond to the project, on finalization | PASS | balance 21300 -> 21200 |
| 11a | a stranger cannot cancel ('not project') | PASS | revert=not project |
| 11b | cancel with zero claims returns the full pool, on finalization | PASS | balance 31200 -> 21200 |
| 11c | claims on a cancelled bounty are refused | PASS | revert=not open |
| 12b | submit after the deadline is refused ('too late') | PASS | revert=too late |
| 12c | withdraw with a PENDING claim is refused even after the deadline | PASS | revert=nothing to withdraw |
| 12d | after the pending claim resolves, the leftover pool is withdrawable, on finalization | PASS | balance 21100 -> 11100 |
| ACC | conservation: contract balance == sum(pool + slashed) + pending bonds | PASS | balance 11100, pools+slashed 11100, pending bonds 0 |

## Notes

- appeal capability on Studionet (genlayer-js 1.1.8): canAppeal => error:canAppeal not supported on this chain (missing appealsContract); getMinAppealBond => error:Appeal bond calculation not supported on this chain (missing feeManagerContract/roundsStorageContract); appealTransaction => error:Invalid parameters were provided to the RPC method. Double check you have provided the correct parameters.

## Transactions

| Step | Status | Revert | Hash |
| --- | --- | --- | --- |
| create_bounty(Deadline bounty) | ACCEPTED |  | `0x0b303d9261c84a809b22e8b5de491105dc1b0cf0399f8fc560f1493c3e6dba29` |
| submit_claim(report) | ACCEPTED |  | `0x9b4a2deeb15c90444ed725fec8e9d136e5998c8a51c14bff753c33c145b8c841` |
| create_bounty(Main bounty) | ACCEPTED |  | `0xfeb47abf3e1a4b53ab5052aa9999b3ccbbf84e8f575cd5780c3f4b0da387c136` |
| submit_claim(01-high-heap-overflow.md) | ACCEPTED |  | `0x0d15fd24ff37fa131aee6eb0d5ce6171498dcad0021bc0a2696128611cbea239` |
| resolve_claim #2 (attempt 1) | FINALIZED |  | `0x6fb4e5d7ea10bf51f562a2a6eda68f8d093663b91076cf53324262815a5b9570` |
| submit_claim(03-duplicate-of-high.md) | ACCEPTED |  | `0xad21d7c46a08f53641a7b1a13064a07bcd445c936896ad7eb5da70d4b7680b59` |
| resolve_claim #3 (attempt 1) | FINALIZED |  | `0x200fff78c4d1f8130b9877e330379c3bb7c7978d1e478454bdf167690bd1d46e` |
| submit_claim(02-medium-oob-read.md) | ACCEPTED |  | `0xeef4ceeed3ee3ff7b8af03ea6c9286dc940d66d8c430f4bf2216c8142dd08c42` |
| resolve_claim #4 (attempt 1) | FINALIZED |  | `0x6794ad2516f19756ffd38221151e06f9ad099feb0621640190e98107f7b8a8d6` |
| submit_claim(04-out-of-scope-dos.md) | ACCEPTED |  | `0xb427618ec0ba38661f7a9504509572fdabc24d2cf3bfcbcc56fa4bee8a687880` |
| resolve_claim #5 (attempt 1) | FINALIZED |  | `0xec998a314b6d64acea04dc673d3137cb90b7272b036444174738255f9dacc125` |
| submit_claim(05-injection.md) | ACCEPTED |  | `0x5798e8eac7de9fa040a724b760e0eccf89bce838d1052c4c1f3cb345445e512f` |
| resolve_claim #6 (attempt 1) | FINALIZED |  | `0xf614e6c325a0bf423da54df27e7dbb2bb4d29a8efab92070174c5c0c4e28bef4` |
| submit_claim(report) | ACCEPTED |  | `0x17856c24cdf71ec3777d89cf1896acbe2a7a9024ccfbf0e82053ea7612aa7911` |
| resolve_claim #7 (attempt 1) | FINALIZED |  | `0x3bbbf77043501ad3ddf58e1aa2a7708f1c8215099a036b3505e3eea7df74044c` |
| submit_claim(report) | ACCEPTED |  | `0x7a43711205a894547805b4f4eae936240f48cc32b8468161d86121da8d8b9983` |
| submit_claim(report) | FINALIZED |  | `0xb461923de12b71026750f59d9655685f8af7a8797016c92e5867eb09b1b7562a` |
| resolve_claim #8 (attempt 1) | FINALIZED |  | `0xa0f89a205aa93dc393476fc02b3d234425709f2f0000b5dfc8d7d44e7f255c26` |
| submit_claim(x) | FINALIZED |  | `0xed0e1383725e4a491e0d24a0dce0fd6d3e0cb6defd1a575e877a1923a76210a7` |
| create_bounty(bad rubric, refused) | FINALIZED |  | `0x1fdb7b28ba60d1f2dff523baf38a2cf03d52e762d2c138408c58fd742945b9dc` |
| withdraw(main) before deadline | ACCEPTED | nothing to withdraw | `0xdc25e9d5535196f6bc672e5ec4bbae0b0c92a78833fb507c4a4dd2aa8e3c0d13` |
| cancel(main) with claims | ACCEPTED | has claims | `0x50a078181019860062783ebc01db53bd9a97512058812ef28c6c6f2161213f8e` |
| create_bounty(Appeal bounty) | ACCEPTED |  | `0xd5bce223cc2709dca75588eddf6250b289b3a5e1e942bff69bf8ba899d5ae03c` |
| submit_claim(report) | ACCEPTED |  | `0xa6d3b6ad616a9a92e13241e788e2964748bfe597403fa5b6885cba582f8360d8` |
| resolve_claim for appeal scenario | ACCEPTED |  | `0xcba8bf9b48e1cbbe10d6d15a56ae566d4b44103c25afdaa0843ba315041e310c` |
| create_bounty(Economy bounty) | ACCEPTED |  | `0x5cd9180b44c6ddc8f92bb9db4200ad4b08c4b1bc1bae5b487c22a39c087aa233` |
| submit_claim(04-out-of-scope-dos.md) | ACCEPTED |  | `0x6d11d288a9c0b00a4035272f88ada1292e2f159af3c1cc90f647d7458b43d6e6` |
| resolve_claim #10 (attempt 1) | FINALIZED |  | `0x353ad27bdc8c7cad0e5aa295ac6865edbe7694f56adf2ac1c83f8e7f8faee9d3` |
| submit_claim(01-high-heap-overflow.md) | ACCEPTED |  | `0x2909dfaa802a39a38dbe95fff3222454766e78f77f988be10b26ac276b2cb8c8` |
| resolve_claim #11 (attempt 1) | FINALIZED |  | `0xf92dd7ce557f234e9eeba1f064665dcc0c1d02f18fe87dea1f0ba6852a9fc1e2` |
| submit_claim(report) | FINALIZED |  | `0xdcab6de4d56fbec2c10f63047306f3237365d40eff06524ae8c5d1947dfb96b9` |
| withdraw(economy) | FINALIZED |  | `0x5920180be1b9bf53bf78fbb9b37f5317b346086e5b8cbeb7104e4947742308af` |
| create_bounty(Cancel bounty) | ACCEPTED |  | `0x0d0ca69744b339aa0c96bca85b1cd18b9807376615a02e4f24c57c0dfb2e3b55` |
| cancel(no claims) | FINALIZED |  | `0xec550b9523d4f94c71fa60778502d15af4ba030bd949bf4de6500fd4ddbc799e` |
| submit_claim(report) | FINALIZED |  | `0x5df1136c6185ee4313087c85c53068dc3345cd7851add83092e6e718a8ab8dce` |
| submit_claim(report) | FINALIZED |  | `0x962cbc6e806c37a2c4f22dff4109f4a8b1363b4447b0cd7c22c3cf14f322ef1a` |
| resolve_claim #1 (attempt 1) | FINALIZED |  | `0x9b01c900aeb0ee8b2bcd6a702a8e708962d7d656911c7f7de48140aa6c7300b7` |
| withdraw(deadline) | FINALIZED |  | `0x80e56b2c4cf48322a88a34ae7d70d80b93911f3a0b4b722752cef1409ca87d33` |
