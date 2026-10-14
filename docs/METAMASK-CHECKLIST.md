# MetaMask walkthrough (manual, needs a real wallet)

The automated suites sign with throwaway keys. They cannot drive a browser-extension wallet, so **this walkthrough has not been run by the build tooling** and is listed as not demonstrated in `docs/STEWARD-RESPONSE.md`. It is written so that one person with MetaMask can do it in about 30 minutes and leave behind evidence a reviewer can check.

You need: Chrome or Edge with MetaMask, two accounts (A = project, B = researcher), and GEN on the network you test (Studionet is free; Bradbury needs faucet GEN). Use https://inquest-repro.vercel.app/.

For every step, write down the **transaction hash** MetaMask shows and the **account balance before and after**.

| # | Account | Action in the app | What to confirm | Record |
| --- | --- | --- | --- | --- |
| 1 | A | **Connect wallet**, approve the network switch/add prompt | the app shows A's address, not "Demo account" | address |
| 2 | A | **Create** a bounty (use *Fill with an example*), confirm in the app dialog, then confirm the MetaMask transaction | MetaMask asks to send the pool as value; "Bounty created"; the bounty page opens | tx hash, A balance −pool |
| 3 | B | switch MetaMask to B, reload, **Connect wallet** | header shows B | address |
| 4 | B | Open the bounty → *Submitted writeups*, paste `https://raw.githubusercontent.com/s70239176-ctrl/inquest/main/fixtures/tinyparse/01-high-heap-overflow.md`, click **Submit with … bond** | the app computes the evidence fingerprint (no prompt), MetaMask asks to send exactly the bond | tx hash, B balance −bond |
| 5 | B | click **Resolve** on the claim (it is the head of the queue) | MetaMask asks for the resolve transaction; wait for ACCEPTED then FINALIZED | tx hash |
| 6 | B | open the claim page | five fields, payout, `Evidence commitment` matches `npm run fingerprint -- <url>`; timeline shows *Finalized* | screenshot |
| 7 | B | check B's balance on the network | on a network that credits accounts from contract transfers B rose by payout + bond | balance before / after |
| 8 | A | switch to A, create a second bounty, then **Cancel and return pool** | MetaMask confirms; after finalization A's balance rose by the pool (minus the fee) | tx hash, balances |
| 9 | A | after a bounty's deadline passes: **Withdraw** | the button shows the withdrawable amount (pool minus any reserve); after finalization A's balance rose | tx hash, balances |
| 10 | B | reject one MetaMask prompt on purpose | the app shows "You declined the request in your wallet." and sends nothing | screenshot |

Notes for the reviewer:

- Steps 7, 8 and 9 read your own wallet balance after finalized payments, which Studionet now credits (see `docs/STEWARD-RESPONSE.md`). `web/e2e/wallet-delivery.mjs` runs the same four payment paths with scripted keys and reads the recipient balances directly.
- Every payable action runs a dry run first; a contract refusal is shown in plain language and the attached value is refunded on finalization.
