# Live end-to-end report (Studionet, contract v2)

- Run: 2026-10-14T10:02:24.265Z → 2026-10-14T18:49:08.078Z (527 min)
- Contract: `0xb2Da7DFe1417D77B858e8D9e306b646b16eA3729` (deploy tx `0xc2c8d07aecd773878667bc12adebb14b4c8e4e3ea1340cf1ed00d06d88c9b376`), parameters retry_gap=90s, max_unavailable=2, claim_expiry=3000s
- Fixtures: https://raw.githubusercontent.com/s70239176-ctrl/inquest/main/fixtures/tinyparse/
- Result: **45/45 checks passed, 0 not demonstrated (platform limitation), 0 failed**

Nothing is mocked: validators fetched the fixture pages and ran their own models. GEN is verified through the contract's own balance and authoritative contract-state readbacks (get_bounty / get_claim / get_params).

| ID | Check | Result | Detail |
| --- | --- | --- | --- |
| D0 | contract deploys and get_params reads back the immutable parameters | PASS | {"claim_expiry":"3000","evidence_chars":"12000","max_accepted":"12","max_claims":"40","max_unavailable":"2","retry_gap":"90"} |
| W0 | a claim filed before the deadline is accepted | PASS | claim 1 |
| Q0 | a claim whose page is unreachable is accepted at filing (the bond is the stake) | PASS | claim 2 |
| C1 | create_bounty locks the attached pool in the contract | PASS | balance +30000 |
| C2 | frozen fields stored; status OPEN; nothing reserved | PASS |  |
| S1 | the claim records the evidence commitment and is PENDING | PASS | hash 4ff39b0f513ed222…, bond locked +100 |
| 2a | in-scope high writeup (page matches its commitment) is judged demonstrated/in-scope/original/high | PASS | evidence=true demonstrated=true in_scope=true dup=null severity=high payout=10000 bond=RETURNED state=ok |
| 2b | payout equals the high band and the bond is returned | PASS |  |
| 2c | NO GEN moves while the resolve tx is only ACCEPTED (provisional) | PASS | before 70300, at accept 70300 |
| 2d | GEN moves on FINALIZATION: contract balance drops by payout + returned bond | PASS | before 70300 -> after 60200 (expected 60200) |
| 2e | pool decremented and the claim is recorded as accepted | PASS | pool 20000 |
| 3a | same area, different cause: not a duplicate; out-of-bounds READ is paid medium (not high) | PASS | evidence=true demonstrated=true in_scope=true dup=null severity=medium payout=3000 bond=RETURNED state=ok |
| 4a | real but excluded (DoS) is judged out of scope: no payout, bond slashed to the project | PASS | evidence=true demonstrated=true in_scope=false dup=null severity=none payout=0 bond=SLASHED state=ok |
| 1a | injection page: never high, never paid | PASS | evidence=false demonstrated=false in_scope=false dup=null severity=none payout=0 bond=RETURNED state=ok |
| 1b | injection page: settled by the table (not-evidence -> bond returned, or not-demonstrated -> bond slashed) | PASS | bond=RETURNED evidence=false |
| 1c | pool after A (high) and C (medium) is exactly 30000-10000-3000 | PASS | pool 17000 |
| 13d | re-resolving a settled claim is refused and moves nothing | PASS | revert=already resolved |
| PAY | finalized transfer increased the researcher's own wallet balance | PASS | wallet 10100 |
| P0 | both claims are accepted, original first | PASS | claims 7, 8 |
| P1 | the later claim cannot be judged before the original ('resolve earlier claim first') | PASS | revert=resolve earlier claim first |
| P2 | readback: head_claim_id is the original and both are still PENDING | PASS | head 7 |
| P3 | the original is judged first and paid in full | PASS | evidence=true demonstrated=true in_scope=true dup=null severity=high payout=10000 bond=RETURNED state=ok |
| P4 | then the copier is a duplicate OF the original: no payout, bond returned | PASS | evidence=true demonstrated=true in_scope=true dup=7 severity=none payout=0 bond=RETURNED state=ok |
| E1 | a page that no longer matches its commitment is judged unsupported: state changed, bond slashed, no payout | PASS | evidence=true demonstrated=false in_scope=false dup=null severity=none payout=0 bond=SLASHED state=changed |
| E2 | the slashed bond is credited to the project's ledger | PASS | slashed 0 -> 100 |
| E3 | an unreachable page is NOT punished on the first attempt: claim stays PENDING (attempts 1) | PASS | evidence=null demonstrated=null in_scope=null dup=null severity=null payout=0 bond=NONE state=unavailable attempts=1 |
| E4 | an immediate retry is refused ('retry too soon'): attempts are spaced apart | PASS | revert=retry too soon |
| E5 | unreachable on every spaced attempt = withdrawn evidence: bond slashed, not refunded | PASS | evidence=false demonstrated=false in_scope=false dup=null severity=none payout=0 bond=SLASHED state=withdrawn |
| R1 | a malformed commitment is refused ('bad hash') and the bond is refunded | PASS | reason=bad hash, net balance change 0 |
| R2 | http:// URL refused with 'bad url' and refunded | PASS | reason=bad url |
| R3 | a second claim while one is pending is refused ('pending exists') and refunded | PASS | reason=pending exists |
| W1 | readback after the deadline with one PENDING claim: reserved == high payout, withdrawable == pool - reserve | PASS | reserved 10000, withdrawable 20000 |
| W2 | withdraw releases only the unreserved pool, on finalization | PASS | balance 84500 -> 64500 |
| W3 | claims after the deadline are refused ('too late') | PASS | reason=too late |
| W4 | the pending claim is STILL paid in full after the project withdrew (nothing stranded) | PASS | evidence=true demonstrated=true in_scope=true dup=null severity=high payout=10000 bond=RETURNED state=ok |
| W5 | after the claim settles the reserve is gone and nothing is left to withdraw | PASS | pool 0, reserved 0 |
| H1 | ten distinct findings are accepted on one bounty (more than an eight-report window) | PASS | accepted 10: 12,13,14,15,16,17,18,19,20,21 |
| H2 | a duplicate of the OLDEST report (#12) is recognised although 9 newer findings were accepted after it | PASS | evidence=true demonstrated=true in_scope=true dup=12 severity=none payout=0 bond=RETURNED state=ok |
| Q1 | a claim cannot be expired before its waiting window ('not expired yet') | PASS | revert=not expired yet |
| Q2 | a claim queued behind an unresolved one cannot be judged ('resolve earlier claim first') | PASS | revert=resolve earlier claim first |
| Q3 | a claim past its window can no longer be judged ('claim expired') | PASS | revert=claim expired |
| Q4 | anyone can expire it: bond returned on finalization, status EXPIRED, no reward | PASS | balance 75500 -> 75400; evidence=null demonstrated=null in_scope=null dup=null severity=null payout=0 bond=RETURNED state=expired |
| Q5 | the queue moves on: the next claim is now the head | PASS | head 23 |
| Q6 | the queued claim is judged and paid after the stuck one expired | PASS | evidence=true demonstrated=true in_scope=true dup=null severity=medium payout=3000 bond=RETURNED state=ok |
| ACC | conservation: contract balance == sum(pool + slashed) + pending bonds + failed-payment ledger | PASS | balance 72300, pools+slashed 72300, pending bonds 0, failed ledger 0 |

## Notes

- claim A jury votes (finalized consensus_data.votes): {"0x3D83ab507785b95ca5C208bEc80CCe3D5ca98100":"agree","0x4aba638Cf0Cf5249437AaD968fC69dde46ae6BAC":"agree","0x772ffCd1dF6Cc566eC4b8d3f4F4f8eBbb6B36C84":"idle","0xBBb165E4c9d73a1493D363280f7067Cd07891dBE":"idle","0xec2Fb79cd12255Eb34886CEd7332f27B98DEe658":"agree"}
- recipient-wallet observation on Studionet: researcher 0x7de42d78bc124f388df46dd7861136086a1bf03c was owed 10100 (finalized transfer, contract balance fell by exactly that) and its own balance reads 10100.

## Transactions

| Step | Status | Revert | Hash |
| --- | --- | --- | --- |
| create_bounty(Withdraw reserve bounty) | ACCEPTED |  | `0x77b7b2c618d5fb438b3d19f060dd27e92096fe62318e9b4d297a9916c441bb6d` |
| submit_claim(01-high-heap-overflow.md) | ACCEPTED |  | `0x7442b5bdbe72ec463f90d49793c482fb03156d2fb9f2a1cce8f718bb2823ed1c` |
| create_bounty(Queue and expiry bounty) | ACCEPTED |  | `0xff07561e4044fef457bb32a66762d7505ea4fdea17da7f96d373ef6f92873efe` |
| submit_claim(report) | ACCEPTED |  | `0xb30acc1a4f2e83c5ac4fcc5bc14475f13674f415d72cbe46c952cc0d6bf1c908` |
| create_bounty(Main bounty) | ACCEPTED |  | `0xc5abe3d9a0e293823b0c0fffde646463da33bb06cf5448b4c979018adaf36518` |
| submit_claim(01-high-heap-overflow.md) | ACCEPTED |  | `0x2d8d222efe3356ed045d1a799cb11390c9104b337e63940cd31baf69d336d859` |
| resolve_claim #3 (attempt 1) | FINALIZED |  | `0xaadc2d645f6499e6f5844d80a666d06ff6e2ba7fe4376caa31a80c0affb975f2` |
| submit_claim(02-medium-oob-read.md) | ACCEPTED |  | `0x2782b25937167624cdb307253836605425334a318de636c6356eaeb8bd975de8` |
| resolve_claim #4 (attempt 1) | FINALIZED |  | `0x120e25fe56c88fbb39fdfb5c2f049ab50ab554e334c31730f372a7bc270a848f` |
| submit_claim(04-out-of-scope-dos.md) | ACCEPTED |  | `0x404ee1047442597311a296b7d4931747e350456b19ecb920e498696ac9a17345` |
| resolve_claim #5 (attempt 1) | FINALIZED |  | `0xb31dc46f5b80ce17a0d50f0445474ca7472692c42f21f45b189c4d7343756b2c` |
| submit_claim(05-injection.md) | ACCEPTED |  | `0x2a6d3bb96096c2a9607b3538df3fa13b4bb0e01d65c693d80538138fb8a1ad03` |
| resolve_claim #6 (attempt 1) | FINALIZED |  | `0x8da53730b9d56c0f42a79e15aadc4fe4d72bd84979cf5e8e2ca4e27f10acf50d` |
| create_bounty(Precedence bounty) | ACCEPTED |  | `0xe2fd6867863e9d0ddb4b3e4999dab97b462896064a4b6633ba7b1680db03bb07` |
| submit_claim(01-high-heap-overflow.md) | ACCEPTED |  | `0x69e3d74a36b6a8a7941036389716ec47a59d7086eb76fee2ce14da4633cb2278` |
| submit_claim(03-duplicate-of-high.md) | ACCEPTED |  | `0x73955d1fb464032e36c1e72da27c34af56677e563b336f05f65caeff5fca44e4` |
| resolve_claim (copier first, refused) | ACCEPTED | resolve earlier claim first | `0x0cc83dc95b265a355d178925bd1dea4f8736f1165bb6d0d21f0d8830b26a3a6b` |
| resolve_claim #7 (attempt 1) | FINALIZED |  | `0x9724bfd4548fd5d7a4df14226aa13cf2351a32938362deb5f973f2a79d1ad34c` |
| resolve_claim #8 (attempt 1) | FINALIZED |  | `0xaf5ff66290b0834f16bb365bfd7b7e5c7e2a0aab685f1c56d253d452bcba0a91` |
| create_bounty(Commitment bounty) | ACCEPTED |  | `0xfbe50b8c9927c55c35a7ce95ea30e50369d38aaf1ae57c134fd97092b90f9b06` |
| submit_claim(01-high-heap-overflow.md) | ACCEPTED |  | `0x0d77a9a3347962628653cbaa11c89cefa66e9450ee371fe64a60f8335ee995a9` |
| resolve_claim #9 (attempt 1) | FINALIZED |  | `0x6e1ef41961f5683c3934f5103267878e8dd6c412e2c54a95e052f7d22f9844f9` |
| submit_claim(report) | ACCEPTED |  | `0x2627a9228b48c52e795ff7254413a9dd9cf24fcce5dab1edb89b6ed13c7d62be` |
| resolve_claim #10 (attempt 1) | FINALIZED |  | `0x110f32f2fc9f6ea0dfb4a9d0c09b006be7d2b981dec753b66fbc20021306c1ba` |
| resolve_claim (retry too soon) | ACCEPTED | retry too soon | `0x07c08d79638f5b014e50307dba1a5a8f76fb725a64d164a7f859ebd91ebd36cf` |
| resolve_claim #10 (attempt 1) | FINALIZED |  | `0xdecdd63a734e590b573e190878f3f7a0e705b8b7312a2d0ea249d2e62b22d36e` |
| submit_claim(01-high-heap-overflow.md) | FINALIZED |  | `0x4dbd350a4a5c1c1ba2b2d8c2d8a20b1b5a6d776e34375cdbc5b9609085282820` |
| submit_claim(x) | FINALIZED |  | `0x668ea47af496b3d978025db59d8a3a970e9e1f0d663156c9659b50966b279e60` |
| submit_claim(02-medium-oob-read.md) | ACCEPTED |  | `0xafc74910fe6bc20690c5e1bb17dfa3a967d89f8f30e44bd5f3a6104ff9ab18ff` |
| submit_claim(02-medium-oob-read.md) | FINALIZED |  | `0x29c12b4ed6568766c7c735ed9f9587b0a3acb2f5f21c0a8d61cac53b16a008f0` |
| resolve_claim #11 (attempt 1) | FINALIZED |  | `0xfe9dc882cfe9640de4d7eb6a266737c72850feee76b1ca6a43fcf14e9579b03e` |
| withdraw(reserve bounty) | FINALIZED |  | `0xa68956c64e62cf388b474c26af715654b31bc5307244a2f6c852688e5b0c8e00` |
| submit_claim(report) | FINALIZED |  | `0x7a7f41d4d078d72e92e17394e5950cbc9d8bc39986024ddd32b4f68fa2088e18` |
| resolve_claim #1 (attempt 1) | FINALIZED |  | `0x0b754b9303c9847989499754d78160087f8ec1b412489831fe9b38b7c35bd705` |
| create_bounty(Full-history bounty) | ACCEPTED |  | `0xa1ff7a4f6ce230659289e4642289c084b545e1330c5dc97c41c690b2a1b88aee` |
| submit_claim(01-high-heap-overflow.md) | ACCEPTED |  | `0xc43175030632e929ef3c4633556805c1b869794b4786087fe0f7f295e32fdf5c` |
| resolve_claim #12 (attempt 1) | FINALIZED |  | `0x9de688ef6c0fd5350bf5447cb215676ab736435c300663dfc001404a29b0fbe0` |
| submit_claim(h01-read-flags.md) | ACCEPTED |  | `0x8685918a3fa580efb6a258f40a7bb66a2fb119acc85011078e7eda94016e4e9d` |
| resolve_claim #13 (attempt 1) | FINALIZED |  | `0xb2f47e2418a2fb2a2dff4f091db9b16cdf072c235e324d0d6c6b9dcab315ef59` |
| submit_claim(h02-open-section.md) | ACCEPTED |  | `0xecc5dc7e28ea065942ad1506e0d91a04e2919cd91ac4b7c4831df9b49792c6ff` |
| resolve_claim #14 (attempt 1) | FINALIZED |  | `0x9c4b8a0af160068cf9d5a52c949e42de93bd6f0408767f4e9a81c8c94a2f507f` |
| submit_claim(h03-decode-utf8.md) | ACCEPTED |  | `0xea2406bad2de451e6b74ed64ab4163501abdc89d2f201d17f54f7d48d74a1f7c` |
| resolve_claim #15 (attempt 1) | FINALIZED |  | `0xe8cfb37fdb7fef7af5f738f236ff341fe00b90d027afdd9dd5e7b7a3b72ea1db` |
| submit_claim(h04-read-alias.md) | ACCEPTED |  | `0xc2f8a40ea7bc0f87f0b49ec6065f88b05fbf086036150e1d1c15d2e2cf5908dd` |
| resolve_claim #16 (attempt 1) | FINALIZED |  | `0xe464aa2a7961fc7eb64b2a44735cfb213592a64504a557351ed53fb0c7aecc04` |
| submit_claim(h05-parse-version.md) | ACCEPTED |  | `0x843ce15e44d81a8e875827c2d109f193b292b6971b6392c207be554f5404b266` |
| resolve_claim #17 (attempt 1) | FINALIZED |  | `0x0475201764cccfe6394934ef1674c7a2501fdc68a175a8eec57aed6190bf0aa2` |
| submit_claim(h06-load-schema.md) | ACCEPTED |  | `0xd5cc722b72f43bfffa3ab66fc13f144d23852a6b3d195d26bfc74d8864843958` |
| resolve_claim #18 (attempt 1) | FINALIZED |  | `0x27e462c45e8f234997d48c5a20ce54b09e3da84e12017706fe9823056cbdb46d` |
| submit_claim(h07-next-token.md) | ACCEPTED |  | `0xe183e69f227711620b50a34f5e3c81936c429d51b915324728d771fe6ab47b7b` |
| resolve_claim #19 (attempt 1) | FINALIZED |  | `0x8cafd8deddc42ae84924b2f37368731e4efb5ab29fec3d5af452c624203f08b8` |
| submit_claim(h08-apply-patch.md) | ACCEPTED |  | `0x6bd2f3271ecebc33158289671aceca5daab3742bb977a6b13dcf6352de44aad9` |
| resolve_claim #20 (attempt 1) | FINALIZED |  | `0xa12f976ed6f9e98c5922872cdc8ecfcb0f5e74d549768e2cd162fcea8b89a417` |
| submit_claim(h09-emit-table.md) | ACCEPTED |  | `0x2379f78a4c2a023c34dc0500e5dcc77c1e3a02eaca93cfcefb51a8f54ed31fd9` |
| resolve_claim #21 (attempt 1) | FINALIZED |  | `0x3876575409aa9511dfd1fdec5aead233f622b227d37a8d4bfa0e5cc4e2e1c682` |
| submit_claim(03-duplicate-of-high.md) | ACCEPTED |  | `0x21b145005f65a59d3d6fc3e381733005d77ce6f39a68215cd9addb8cdfcb6349` |
| resolve_claim #22 (attempt 1) | FINALIZED |  | `0x413dc1515e88191ebcc53e23617d8715ddb84600f70086c1cd92c9dd124704cb` |
| expire_claim (too early) | ACCEPTED | not expired yet | `0x6fedbd6404f2d8a5ac8f574bfe965bd4360da4c5851004a7d1bad3d3c293e9d1` |
| submit_claim(02-medium-oob-read.md) | ACCEPTED |  | `0x4070c06169f1ba60dab602089583f86b4a5b3e7579da467b199677dd8a510fc6` |
| resolve_claim (queued behind an unresolved claim) | ACCEPTED | resolve earlier claim first | `0x0def5ac5a53c7566079c0ce497bdfe1c179a4460ed19b886a51849ce19cd60f4` |
| resolve_claim (after the window) | ACCEPTED | claim expired | `0x7f2ff604f9de268433eb4512c63a6fa47ad347641d29fe3e246903a20c32a79c` |
| expire_claim | FINALIZED |  | `0x9606372045031fb9214b8433eb116f0c0a9340ecd930c8926dcb895fb820068f` |
| resolve_claim #23 (attempt 1) | FINALIZED |  | `0x2f8a861475b34a3aa72163d5abca9b1aaac5aa7a5290dfb130702f732e65361c` |
