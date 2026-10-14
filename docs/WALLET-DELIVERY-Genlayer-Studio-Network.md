# Recipient-wallet delivery report

- Network: Genlayer Studio Network
- Contract: `0xf4DD8CdA92de0850e3b0109243E32E03dd16Af47` (deploy tx `0xb099f0f96665e4652c30387b602e8bfe27d27079987715b4d113fa0e8f45639d`)
- Project: `0xd34b22F01cfd81C0643CAc1e6489562e8363f5d4`
- Researcher: `0x3e01F9459Bc9b8C94e64a8bFc59f7cc0180768bf`
- Funded accounts supplied by the operator: no (throwaway keys)
- Result: **5/5 paths delivered to the recipient's own balance**

| Path | Check | Result | Balances |
| --- | --- | --- | --- |
| 1 | researcher reward + bond refund reach the researcher's own wallet | DELIVERED | balance 0 wei (0.000000 GEN) -> 100500000000000000 wei (0.100500 GEN); expected +100500000000000000 wei (0.100500 GEN); resolve tx FINALIZED |
| 2 | bond refund (duplicate, no reward) reaches the researcher's wallet | DELIVERED | balance 0 wei (0.000000 GEN) -> 500000000000000 wei (0.000500 GEN); expected +500000000000000 wei (0.000500 GEN) |
| 3 | bounty cancellation returns the pool to the project's wallet | DELIVERED | balance 0 wei (0.000000 GEN) -> 100000000000000000 wei (0.100000 GEN); pool 100000000000000000 wei (0.100000 GEN) (difference is the cancel transaction's own fee) |
| 4 | project withdrawal reaches the project's wallet | DELIVERED | balance 0 wei (0.000000 GEN) -> 100000000000000000 wei (0.100000 GEN); withdrawable 100000000000000000 wei (0.100000 GEN) (difference is the withdraw transaction's own fee) |
| L | no outgoing transfer failed (failed-payment ledger is empty) | DELIVERED | get_failed_total 0; contract balance 100000000000000000 wei (0.100000 GEN) |

## Transactions

| Step | Status | Revert | Hash |
| --- | --- | --- | --- |
| create_bounty(1) | ACCEPTED |  | `0x3e3ecdb06e8e3acde5ba41a23d9368b2348ef574ae8d176bd93f98871166e0e6` |
| submit_claim(original) | ACCEPTED |  | `0x045bb7f47678636f8f152b8df9ac4953a4d8436cb4bddf29c90372abc217b761` |
| submit_claim(duplicate) | ACCEPTED |  | `0x740f466aa4170ad9b016da744ce36e9b27bb661a1a93bdc3c888b99c21bc0c09` |
| resolve_claim(original) | FINALIZED |  | `0xa954ef5bae6b7bf43a38c10744be7d1a4ed805ad3bc8cdd4740a919de9d28390` |
| resolve_claim(duplicate) | FINALIZED |  | `0xaf080ad74b3bfcf4ee5b3748d6437802618aae94ddeba077e2efd0bfb7195d42` |
| create_bounty(cancel) | ACCEPTED |  | `0xf5510016cf377046dd6607306e507ba91ee80815630b2a8083201b7c24fb76f0` |
| cancel | FINALIZED |  | `0xb9acf447fdf2ed41cd5e182f60f8707a8da8c0df9eff335fa0bf09d9e2bb91af` |
| create_bounty(withdraw) | ACCEPTED |  | `0x7dd34fa1bce56d90cdb341bbc040879b9f8d21bfcc08d71699ad5954c6b8c98c` |
| withdraw | FINALIZED |  | `0xc435a8f8e654d97a325212afa0f5fab4b3ed8b498ee452d56850977a8686c819` |
