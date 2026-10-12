# Demo script (5 minutes)

Goal: show that **a hostile page cannot pay itself, a duplicate cannot be paid twice, and GEN only moves when a verdict finalizes.**

Prereqs: the app on Studionet (`npm run dev` in `web/`, or the hosted build) and the fixture pages in `fixtures/tinyparse/` (public on GitHub raw). No wallet needed: **Use demo account** creates a throwaway key in the browser.

1. **Create** (`Create` → *Fill with an example* → *Use demo account* → *Lock pool and create bounty*).
   Point out the checklist: bond bounds, "pool covers one high payout", four rubric sections. The rubric and pool are now frozen on-chain: no admin key exists.
2. **Submit the real bug** (new browser profile or *Reset* to get a second demo account, so the project is not the claimant).
   `https://raw.githubusercontent.com/s70239176-ctrl/inquest/main/fixtures/tinyparse/01-high-heap-overflow.md`
   Bond is shown on the button. Nothing is paid at submit.
3. **Resolve.** Click *Resolve*. Narrate: every validator fetches the page itself and answers five fields. When the tx shows *ACCEPTED*, open **Claim**: the verdict tiles read `demonstrated true · in_scope true · duplicate_of null · severity high`, but the timeline says *waiting for finalization*, and the **protocol appeal window is open** with a charge quoted by the protocol. After finalization the timeline shows the payout and the returned bond.
4. **Duplicate.** Submit `03-duplicate-of-high.md` from a third account (it claims to be "completely novel"). Verdict: `duplicate_of: claim 1`, no payout, bond returned.
5. **Injection.** Submit `05-injection.md` (a page that tells the model to answer true/high). Verdict: not demonstrated, bond **slashed** to the project, pool untouched.
6. **Out of scope.** `04-out-of-scope-dos.md` is a real DoS the rubric excludes: slashed.
7. **Money.** On the bounty page the pool shrank by exactly the payout; as the project, *Withdraw* shows the slashed bonds once the deadline passes or the bounty depletes.

Talking points: GenLayer is the settlement layer, not a plugin: remove it and there is no one to decide. No backend, no oracle, no admin. If the jury cannot decide (try a long, ambiguous writeup), the claim stays pending and no GEN moves.
