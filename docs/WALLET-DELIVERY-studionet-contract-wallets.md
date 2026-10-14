# Recipient-balance delivery to smart-contract wallets (Studionet)

Studionet does not credit externally-owned accounts from contract-emitted transfers, so this run uses contract wallets (`tests/support/proxy_wallet.py`) as project and researchers. It proves the four payment paths deliver finalized value to a recipient's own balance on this network. It does **not** prove delivery to an EOA; `web/e2e/wallet-delivery.mjs` does that on a testnet.

- Inquest: `0xF72403393A2a246c64C6aA984471d0CB2E0bA39D` (deploy tx `0x422702844b7ddf25a43efa697b169f907ad70ee761accad7e936bf8f7a93e6bc`)
- W1 (project): `0xcd82713c14023b05c0AA15dB6E64B194Ac50554D`
- W2 (researcher, reward): `0x7e87b3150B3C8960eBA94a1C0948DFeC9DBBa7f1`
- W3 (researcher, duplicate): `0x151775033e172c9Fb782E53ccE52987CcBebe0e6`
- Result: **6/6 checks delivered**

| Path | Check | Result | Balances |
| --- | --- | --- | --- |
| setup | the project is a smart-contract wallet; the pool left W1 | DELIVERED | W1 0xcd82713c14023b05c0AA15dB6E64B194Ac50554D, pool 30000 |
| 1 | researcher reward + bond refund reach the researcher wallet | DELIVERED | W2 balance 0 -> 10100 (expected +10100); __receive__ calls 1, total received 10100; claim RESOLVED payout 10000 bond RETURNED; resolve tx FINALIZED |
| 2 | bond refund (duplicate, no reward) reaches the researcher wallet | DELIVERED | W3 balance 0 -> 100 (expected +100); duplicate_of 1, payout 0; resolve tx FINALIZED |
| 3 | bounty cancellation returns the pool to the project wallet | DELIVERED | W1 balance 0 -> 10000 (expected +10000); bounty CANCELLED |
| 4 | project withdrawal reaches the project wallet | DELIVERED | W1 balance 10000 -> 30000 (expected +20000) |
| L | no outgoing transfer failed (failed-payment ledger is empty) | DELIVERED | get_failed_total 0 |

## Transactions

| Step | Status | Revert | Hash |
| --- | --- | --- | --- |
| w1.forward(create_bounty) | ACCEPTED |  | `0x6de2a607394883370c739da9429c45e16965af3fd5fceb7c39e16d1826832555` |
| w2.forward(submit_claim) | ACCEPTED |  | `0x33e3aab29b219a072a2af22cb95c216c16b55083d5b0cf6d4b38922d3d67deb2` |
| w3.forward(submit_claim) | ACCEPTED |  | `0x1f58ced69cde096450e147918463609c82dd26914f7ce580127e7628f2a0b46e` |
| resolve_claim(original) | FINALIZED |  | `0xb1c20855b8fb39b720dc31cb177a80d0f017e64adb97dba86b4758a3896f89e7` |
| resolve_claim(duplicate) | FINALIZED |  | `0xf9503224c71356d6ea6991f36f45e2bd5d4b1234e84c1c4bd32691ce0c2ebe6f` |
| w1.forward(create_bounty) | ACCEPTED |  | `0xdcb3b1162eb90b492377644dd803b1fb81339804ce3ac87159d527d5dcb59063` |
| w1.forward(cancel) | FINALIZED |  | `0x777121c60aecd1873c2c24e5bbddb4367143918ac5d2affe978eb1ea5ce7c031` |
| w1.forward(create_bounty) | ACCEPTED |  | `0x00363507d3e8c1e87db2c329b8b7adce73891fbac0daeec8b23105d2494405c8` |
| w1.forward(withdraw) | FINALIZED |  | `0x32357a824cb8162dff5c3fd5228bf24e659c0e500d5ae2e2badddfa74bf641f6` |
