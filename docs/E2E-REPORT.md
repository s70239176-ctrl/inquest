# Live end-to-end report (Studionet, contract v2)

- Run: 2026-10-14T08:14:59.585Z → 2026-10-14T09:09:08.243Z (54 min)
- Contract: `0x6c467DB3E69746a9D9f9fCa6d8c580FCd306b245` (deploy tx `0x6fd877ee8d394157fbae4e2156f82f65c873c17dbb899351c34a5b0d2c119157`), parameters retry_gap=90s, max_unavailable=2, claim_expiry=3000s
- Fixtures: https://raw.githubusercontent.com/s70239176-ctrl/inquest/steward-v2/fixtures/tinyparse/
- Result: **44/45 checks passed, 1 not demonstrated (platform limitation), 0 failed**

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
| 1a | injection page: never high, never paid | PASS | evidence=true demonstrated=false in_scope=false dup=null severity=none payout=0 bond=SLASHED state=ok |
| 1b | injection page: settled by the table (not-evidence -> bond returned, or not-demonstrated -> bond slashed) | PASS | bond=SLASHED evidence=true |
| 1c | pool after A (high) and C (medium) is exactly 30000-10000-3000 | PASS | pool 17000 |
| 13d | re-resolving a settled claim is refused and moves nothing | PASS | revert=already resolved |
| PAY | finalized transfer increased the researcher's own wallet balance | NOT DEMONSTRATED | NOT demonstrated on Studionet: wallet balance is 0. Studionet does not credit externally-owned accounts from contract-emitted transfers (measured; see docs/STEWARD-RESPONSE.md). |
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
| W2 | withdraw releases only the unreserved pool, on finalization | PASS | balance 84600 -> 64600 |
| W3 | claims after the deadline are refused ('too late') | PASS | reason=too late |
| W4 | the pending claim is STILL paid in full after the project withdrew (nothing stranded) | PASS | evidence=true demonstrated=true in_scope=true dup=null severity=high payout=10000 bond=RETURNED state=ok |
| W5 | after the claim settles the reserve is gone and nothing is left to withdraw | PASS | pool 0, reserved 0 |
| H1 | ten distinct findings are accepted on one bounty (more than an eight-report window) | PASS | accepted 10: 12,13,14,15,16,17,18,19,20,21 |
| H2 | a duplicate of the OLDEST report (#12) is recognised although 9 newer findings were accepted after it | PASS | evidence=true demonstrated=true in_scope=true dup=12 severity=none payout=0 bond=RETURNED state=ok |
| Q1 | a claim cannot be expired before its waiting window ('not expired yet') | PASS | revert=not expired yet |
| Q2 | a claim queued behind an unresolved one cannot be judged ('resolve earlier claim first') | PASS | revert=resolve earlier claim first |
| Q3 | a claim past its window can no longer be judged ('claim expired') | PASS | revert=claim expired |
| Q4 | anyone can expire it: bond returned on finalization, status EXPIRED, no reward | PASS | balance 75600 -> 75500; evidence=null demonstrated=null in_scope=null dup=null severity=null payout=0 bond=RETURNED state=expired |
| Q5 | the queue moves on: the next claim is now the head | PASS | head 23 |
| Q6 | the queued claim is judged and paid after the stuck one expired | PASS | evidence=true demonstrated=true in_scope=true dup=null severity=medium payout=3000 bond=RETURNED state=ok |
| ACC | conservation: contract balance == sum(pool + slashed) + pending bonds + failed-payment ledger | PASS | balance 72400, pools+slashed 72400, pending bonds 0, failed ledger 0 |

## Notes

- claim A jury votes (finalized consensus_data.votes): {"0x03D58A4DeF6fDFc032A56374785a5F571D07Bc11":"agree","0x14402D49f317CE1a2F35BAE01b1804A2A9703dCb":"idle","0x4404Fb70d490c935758146f42A73DC850FF95C71":"agree","0x6737ca1d6BDF8b7C4f19143E2D55581Ca64eb7C3":"agree","0xBBb165E4c9d73a1493D363280f7067Cd07891dBE":"idle"}
- recipient-wallet observation on Studionet: researcher 0xd0f78642abc9fdcdeda854f12cebbea635ab601f was owed 10100 (finalized transfer, contract balance fell by exactly that) and its own balance reads 0.

## Transactions

| Step | Status | Revert | Hash |
| --- | --- | --- | --- |
| create_bounty(Withdraw reserve bounty) | ACCEPTED |  | `0x58ca31ffa920bafc58319f5fab1115f889ed12cd77ecb1847025d9e79a864436` |
| submit_claim(01-high-heap-overflow.md) | ACCEPTED |  | `0xb5fd66d3110c53d8123790f751b735b686fb0a16fdab9df35be5aee59b9a0878` |
| create_bounty(Queue and expiry bounty) | ACCEPTED |  | `0xc78f363a33c737c337820ae61a100f8a5f957c2e2095df83ee79d5810f8303ed` |
| submit_claim(report) | ACCEPTED |  | `0x4cfce7342e0951708cd42b8cb768933add8101e82e25524b2821adbaa3e31256` |
| create_bounty(Main bounty) | ACCEPTED |  | `0x3b6d4ef1bc7237b8c30b926c179aab0b0a2bb35a92b47f52a53676d988fdd27f` |
| submit_claim(01-high-heap-overflow.md) | ACCEPTED |  | `0xa26fabcfbaadc37952fd184a14a4e1a9a808da1cf87a1d3bfeb413523dfa63de` |
| resolve_claim #3 (attempt 1) | FINALIZED |  | `0x30cf1aaa9d5f3e7ea39e4ed370b0f279cf2877cff084fbc105e2a53e328d48c6` |
| submit_claim(02-medium-oob-read.md) | ACCEPTED |  | `0xf74d2119ca0de9cb396e4a3965937b7b1b0f4e950f52243fad40139630d4bad9` |
| resolve_claim #4 (attempt 1) | FINALIZED |  | `0x91e6fd1ff707a07592a6be22bf6c6cdf48fae1ed5d0ad1753a4adac37fa1b1fe` |
| submit_claim(04-out-of-scope-dos.md) | ACCEPTED |  | `0x62aa914297383bb0ca5aed792233a6b57ac7fd833fd31158365327ffea329a5d` |
| resolve_claim #5 (attempt 1) | FINALIZED |  | `0x3f68a7ebb0627096364b627abcb78ba01ce5f2fe6405de7992962bce9187f01e` |
| submit_claim(05-injection.md) | ACCEPTED |  | `0xd828daa54cf114aecd829a5423c0da3540f2975e724201d4319e3a59a484f301` |
| resolve_claim #6 (attempt 1) | FINALIZED |  | `0xf86ee1fca0dd05a184134323784b5ae66ea97660b6f4f2eeb4f3fd026d96ece9` |
| create_bounty(Precedence bounty) | ACCEPTED |  | `0xf87fa692a0144c8d6df25a73ae26918610bc35d008a4ce2bb95b5f40c48fd839` |
| submit_claim(01-high-heap-overflow.md) | ACCEPTED |  | `0xd2b1fa1ba39996a171c948d638ca1c62adbd63aea4df0bea47a59b0ddfff1321` |
| submit_claim(03-duplicate-of-high.md) | ACCEPTED |  | `0xff088612ea04b8dc1666eb181aae4397d5a4be9bb4ee4cb897f0c25494149bcd` |
| resolve_claim (copier first, refused) | ACCEPTED | resolve earlier claim first | `0x7a4a889c2014d1966699dc86646f12625c6840b1d6486d09b0b1bd1fc3dc8da9` |
| resolve_claim #7 (attempt 1) | FINALIZED |  | `0xd64c465e3a5ecd60d49ba757eb820c3e8feec82d2d4ca8037d94b37c0bd1b17b` |
| resolve_claim #8 (attempt 1) | FINALIZED |  | `0xf785e460e2f5be0313739e7268e060058b1950095f9412a77d98a24f4fcacc5c` |
| create_bounty(Commitment bounty) | ACCEPTED |  | `0xa1df89375f4730a0ff476f42a28c9111cc6217dcaf2138b5cd6e21d0e8eeec3e` |
| submit_claim(01-high-heap-overflow.md) | ACCEPTED |  | `0x378b3ad179be3df942f0447d541a8da33456bc7f6332509ac4c3ce6c700448b3` |
| resolve_claim #9 (attempt 1) | FINALIZED |  | `0x0525f9ceb6f697571d0e4f9d18e681c76f69fc1ffe552181a1c941e6ad15baec` |
| submit_claim(report) | ACCEPTED |  | `0x1596ad69c35f7c6bf647bf02a3c84cfd27c22451e58303d99881d1eb3b085c56` |
| resolve_claim #10 (attempt 1) | FINALIZED |  | `0xfb932d456e4c2298adf0a9e7fa0ae32b42e7500645f8896e0c78df82e43a109b` |
| resolve_claim (retry too soon) | ACCEPTED | retry too soon | `0xbc13da8f1d2463bf03b444e1461dce55eab7ed3c2bc37267cd8081232591e63d` |
| resolve_claim #10 (attempt 1) | FINALIZED |  | `0x735c7f57b360e620a134589a88427634c3c95f3bf5362617b0977327e467806b` |
| submit_claim(01-high-heap-overflow.md) | FINALIZED |  | `0x92c7e34a9db2bc08783f08269041030c906151cb928aec8c06a98cb3cc572fb5` |
| submit_claim(x) | FINALIZED |  | `0x0f5f29a358c97ba1b7fdf02b330a33d1be29583a5224bbc6fde6ade5d3097aa7` |
| submit_claim(02-medium-oob-read.md) | ACCEPTED |  | `0xcd365d039c2c9a67acf29aa0f6f8cc1ce9b2f39885724721feb53e59490f80c1` |
| submit_claim(02-medium-oob-read.md) | FINALIZED |  | `0xd0a40e18509a8ba04668a45dc8336a870adc20e9485ef4dba76dd3b0e7af351b` |
| resolve_claim #11 (attempt 1) | FINALIZED |  | `0xf64c18edac205aaf39697cab9e128b87068bdfb9f179cd5a16f54142e4cde15e` |
| withdraw(reserve bounty) | FINALIZED |  | `0x9e83b2dc631b6db8ac2fd3baf0e850ac8c6996e3cafae132fe0faa5a523bcd9f` |
| submit_claim(report) | FINALIZED |  | `0x94361405d9221429b474748c7775fd21bfec93d8bf41db928766aab06189ee64` |
| resolve_claim #1 (attempt 1) | FINALIZED |  | `0x36990bfdc005e9a1161803699b5810d377a3d4ca3108c3d310bc7c8404fa4b30` |
| create_bounty(Full-history bounty) | ACCEPTED |  | `0xc2c418d9f30538be8336480d11558461ecc607ae23775e7f07726a5694a9bf4a` |
| submit_claim(01-high-heap-overflow.md) | ACCEPTED |  | `0xaea76ebe87154b7503fd5f683ed6f83158fe5de311934cc3eb38db20a5478574` |
| resolve_claim #12 (attempt 1) | FINALIZED |  | `0xc7f925b7ce193bdd63704b53dfd2bcda8d49a7548f042adf7041d06bb6103569` |
| submit_claim(h01-read-flags.md) | ACCEPTED |  | `0xf56aff14415e19ac3f5ac6255c7c81be0b0f3687358631dcc7fa10b05f6c08dc` |
| resolve_claim #13 (attempt 1) | FINALIZED |  | `0x941b11d3f6e6268a84e46bab9a5245001741a97afda3401ba689371caf7de3a5` |
| submit_claim(h02-open-section.md) | ACCEPTED |  | `0x32ade30d7b420d2ca7b9e5243132d63d00f7ea65273cea1ebe323c8ddb44c215` |
| resolve_claim #14 (attempt 1) | FINALIZED |  | `0x30a5fb7a8eaaf411b0ed0385726e31d14c6c0ebf958668f079c43b9984c501f9` |
| submit_claim(h03-decode-utf8.md) | ACCEPTED |  | `0x2c2c19a6de2afac2e50e14d135deac386ede49dca18666eb6c9b4a2a3c0fcedd` |
| resolve_claim #15 (attempt 1) | FINALIZED |  | `0xe37dcd916b36d25595cc381204d943487d0cca7bc50e048e30d311ec6460240e` |
| submit_claim(h04-read-alias.md) | ACCEPTED |  | `0x11f9d492a215ed46c271bc272aae881142a226f510659d546f699a968a113fb2` |
| resolve_claim #16 (attempt 1) | FINALIZED |  | `0xf60337d2f92f049aa94ae2e5aee2618b4c60cff52f3dc9dc299b2fdbb711a7ce` |
| submit_claim(h05-parse-version.md) | ACCEPTED |  | `0x86512dc066895a0b6ecfdb5d089a84b9007d2ae433a5f847dbf84255ba6d10bc` |
| resolve_claim #17 (attempt 1) | FINALIZED |  | `0x33fddf896ded168b452facd5d53e4abde06cdaacdc927ca8127346866380bc45` |
| submit_claim(h06-load-schema.md) | ACCEPTED |  | `0x6951d1efb958f5039ab618f6130c918316c79c1749796b928ce7eaf634b8e0f2` |
| resolve_claim #18 (attempt 1) | FINALIZED |  | `0x6d878189cfed196e4b77cb5fa322e7ac5a87df71ad939ce63abb531ca85cea64` |
| submit_claim(h07-next-token.md) | ACCEPTED |  | `0xfcaa60fc12883827a9af3aac36f349540174aef0ebf005f1e6dd8a0fda87954f` |
| resolve_claim #19 (attempt 1) | FINALIZED |  | `0xf1c2ea5f2415ec9c46c686b17bccd963b36c068bba955d0ad2c543c113b46d93` |
| submit_claim(h08-apply-patch.md) | ACCEPTED |  | `0x67bff867050f821c2d91d164b8723cc7cf2f7c227d3db806134c6798abc5f4ad` |
| resolve_claim #20 (attempt 1) | FINALIZED |  | `0xe6df7ba4ea6043cf8ee53d435de5e2ef00404ddc91e430f999eab390daf8c36f` |
| submit_claim(h09-emit-table.md) | ACCEPTED |  | `0x7879dafd5ffbc28e5c367dea16807c3ac971b0328bfd6c193b1716b2927aa0e2` |
| resolve_claim #21 (attempt 1) | FINALIZED |  | `0x10a5cae27e7ac333696ab61e86e36b4d3a426f78ec11e74c298966f79b4432b4` |
| submit_claim(03-duplicate-of-high.md) | ACCEPTED |  | `0xd6ddd58969ce0e49e92fd55d921d94460c4104261e4dcfc67e1c0fa9b219d0bf` |
| resolve_claim #22 (attempt 1) | FINALIZED |  | `0xc682394112f7d34fec62cb81228a5f895b9119c8b5d04fb6e1a9a431da2aca26` |
| expire_claim (too early) | ACCEPTED | not expired yet | `0x441c9ae609b1e0f6fd26f5f5ec3a60eaceeba3cd7ccff1e07575ef5790bd80b9` |
| submit_claim(02-medium-oob-read.md) | ACCEPTED |  | `0xa873fb6664ed3405e56a1cc9bbb4b1ae1f3922e88863df753842f69c23124fa6` |
| resolve_claim (queued behind an unresolved claim) | ACCEPTED | resolve earlier claim first | `0x6d24a27e449e28d667651f90a1366705f99ae3628a4b094bf7469a4f016ae8a1` |
| resolve_claim (after the window) | ACCEPTED | claim expired | `0xfea09f1dcd6233fbae1c5b69d354305b70054f65c7afd550030b2a6b85104194` |
| expire_claim | FINALIZED |  | `0x9c29181d6671fb2a41f9b93c1ed7c97bc7060c3cc44ff3cc8b0a391e2236f382` |
| resolve_claim #23 (attempt 1) | FINALIZED |  | `0x71e99bd38e53d7fe1995a8fad1948e27f7373abe6d2d4edc2df99d35001fc377` |
