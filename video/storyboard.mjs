// The storyboard is the single source of truth for the video: narration text (for ElevenLabs), the captions shown on
// screen, and which real screen of the live app illustrates each moment. ~200 words of narration, sized for ~90 seconds.

export const BASE = process.env.INQUEST_URL ?? "https://inquest-repro.vercel.app";
export const CONTRACT = "0xb65Ff1E3F4DDE55fF56d3A5ee98f51aDB7944630";
// The real resolve transaction behind claim #1 on that contract (used to load the validators' votes in a clean browser)
export const RESOLVE_TX_CLAIM_1 = "0xd0d3a795718d68f9f4299857aae745e199aa750848fb62aa0a906dbe50d18231";

export const TARGET_SECONDS = 90;

/**
 * scene.narration: spoken as ONE voiceover take (natural intonation across the sentences).
 * scene.shots: the screens shown during that take, each with an on-screen caption and a named capture action.
 */
export const scenes = [
  {
    id: "s1-trust",
    narration: "Bug bounties run on trust. Researchers hope a reviewer plays fair. Projects hope a report is real. Inquest replaces that trust with a jury.",
    shots: [
      { id: "home", action: "home-top", caption: "Bug bounties run on trust." },
      { id: "art", action: "home-art", caption: "Inquest replaces that trust with a jury." },
    ],
  },
  {
    id: "s2-how",
    narration: "A project locks a prize and a rulebook that can never be edited. A researcher posts one public writeup and a small deposit. Nothing is ever run against anyone.",
    shots: [
      { id: "steps", action: "how-steps", caption: "A project locks a prize and a frozen rulebook." },
      { id: "feed", action: "latest", caption: "A researcher posts one public writeup and a small deposit." },
    ],
  },
  {
    id: "s3-fields",
    narration: "Independent validators each read the page themselves, and answer five fixed questions: is the evidence there, does it show the bug, is it in scope, is it a duplicate, how severe?",
    shots: [
      { id: "fields", action: "five-fields", caption: "Five fixed questions. Nothing else." },
      { id: "rubric", action: "rubric-tab", caption: "Judged against the project's own frozen definitions." },
    ],
  },
  {
    id: "s4-create",
    narration: "Creating a bounty takes three steps: describe it, write the rubric and payouts, then review. Because the rules are frozen and the prize is locked, Inquest asks you to confirm first.",
    shots: [
      { id: "step1", action: "create-1", caption: "Describe the bounty." },
      { id: "step2", action: "create-2", caption: "Write the rubric and the payouts." },
      { id: "step3", action: "create-3", caption: "Review. This cannot be undone." },
      { id: "confirm", action: "create-confirm", caption: "Confirm before anything moves." },
    ],
  },
  {
    id: "s5-verdict",
    narration: "Here, a researcher's writeup was judged: evidence found, bug demonstrated, in scope, original, rated high. The verdict is provisional until it finalizes, and only then does the prize move.",
    shots: [
      { id: "verdict", action: "claim-verdict", caption: "Evidence found. Bug demonstrated. In scope. Original. High." },
      { id: "timeline", action: "claim-timeline", caption: "Provisional until it finalizes. Then the prize moves." },
    ],
  },
  {
    id: "s6-jury",
    narration: "You can inspect the jury itself: three validators agreed, the rest weren't needed. Evidence, votes and verdict stay separate.",
    shots: [{ id: "jury", action: "jury", caption: "Evidence, votes and verdict stay separate." }],
  },
  {
    id: "s7-close",
    narration: "A duplicate can't be paid twice. A page that tries to talk the jury into paying gets nothing. If the jury can't decide, no money moves. Inquest: a bug isn't real until it repros.",
    shots: [
      { id: "list", action: "bounties", caption: "If the jury can't decide, no money moves." },
      { id: "end", action: "closing", caption: "A bug isn't real until it repros." },
    ],
  },
];

export const wordCount = (s) => s.trim().split(/\s+/).length;
