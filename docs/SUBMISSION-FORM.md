# Submission form: ready to paste

Character counts are checked against the form's limits.

## 01 Project

**Project name:** Inquest

**Primary tag:** Dispute Resolution

**Tag 1 / Tag 2:** pick the closest two topics the form offers inside Dispute Resolution. Best fits: *evidence review* (or *adjudication*) and *bounties* (or *security*). Inquest settles one claim at a time from public evidence under a frozen rubric.

## 02 Project summary

**One-liner (175/180):**

> A bug bounty settled by a jury: validators independently read one public writeup, answer five fixed questions, and a plain table pays, slashes or refunds. No admin, no oracle.

## 03 Project overview

**Description (877/1000):**

> Inquest is a bug bounty with no reviewer to trust. A project locks GEN and a frozen rubric (scope, duplicates, severity bars). A researcher submits one public writeup URL and a small bond. Each GenLayer validator fetches the page itself and answers five fixed fields: evidence_available, demonstrated, in_scope, duplicate_of, severity. Validators accept the leader only if all five match their own result; prose is never compared. A deterministic table then pays, slashes or refunds, and GEN moves only when the verdict finalizes. A page that tells the model to pay is treated as evidence, never a command. If the jury cannot agree, no money moves. Reports are judged in submission order, against every earlier accepted finding, and a page edited after filing is slashed. Verified live on Studionet: 44 of 45 checks (the 45th, delivery to a plain wallet, is a Studionet limit).

## 04 Demo video

**Demo URL (optional):** leave blank until the narrated video is uploaded to YouTube or X, then paste the direct post link. The silent preview is at `video/out/inquest-demo-preview-silent.mp4`.

## 05 How-to (the exact path)

Each item is one step: heading (optional) then instruction.

1. **Open the app.** Go to https://inquest-repro.vercel.app/ and click **Use demo account** (top right). No wallet is needed.
2. **Create a bounty.** Click **Create**, then **Fill with an example**, then **Continue** twice. Click **Lock pool and create bounty** and confirm in the dialog. Wait about 30 seconds for "Bounty created", then click **Open your bounty**.
3. **Become a researcher.** Open the account menu (top right), choose **Reset demo account**, then click **Use demo account** again. This gives you a fresh account, because a project can't file a report on its own bounty.
4. **File a report.** Go back to your bounty (**Bounties**, then open it), open the **Submitted writeups** tab and paste `https://raw.githubusercontent.com/s70239176-ctrl/inquest/main/fixtures/tinyparse/01-high-heap-overflow.md`. Click **Submit with 0.01 GEN bond**. Your browser fingerprints the page (the commitment) and sends it with the bond. The claim appears as *Under review*.
5. **Run the jury.** Click **Resolve** on the claim (claims are judged oldest first). The validators each fetch the page and vote. Allow up to about two minutes.
6. **Inspect the verdict.** Click the claim number to see the five fields and the settlement timeline. Then open the bounty's **Jury review** tab and click **Load validator votes** to see each validator's vote.

Shortcut (optional): https://inquest-repro.vercel.app/#/b/1/jury opens a real, already-finalized claim with the validators' votes.

## 06 Review verification

**Expected verification outcome (443/500):**

> The claim shows its evidence commitment, then evidence_available true, demonstrated true, in_scope true, duplicate_of null, severity high (the jury is a model, so borderline pages can differ; this fixture was rated high in every live run). Payout equals the bounty's high payout (1 GEN in the example) and the 0.01 GEN bond is returned. GEN does not move until the resolve tx is FINALIZED. Jury review lists the validators' votes (agree/idle).

**Contract link 1:** https://explorer-studio.genlayer.com/address/0xb65Ff1E3F4DDE55fF56d3A5ee98f51aDB7944630

(Deploy transaction: https://explorer-studio.genlayer.com/tx/0x6e759e8f45c53ce64df08ec3b20ddfb25bbe42fdbd642ba84f8da07a9935384e)

## 07 Project links

**Website (required):** https://inquest-repro.vercel.app/

**GitHub:** https://github.com/s70239176-ctrl/inquest
