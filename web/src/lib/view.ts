/**
 * View logic: how contract fields become on-screen states, search, filters and sorting.
 * Pure and dependency-free so it is unit-tested in node. Nothing here invents data: every label is derived from fields
 * the contract returns.
 */
import { splitRubric } from "./rubric.ts";
import type { Bounty, Claim } from "./types.ts";

export type Tone = "gold" | "green" | "amber" | "gray" | "red";

export type BucketId = "accepting" | "review" | "settled";

export interface Phase {
  bucket: BucketId;
  label: string;
  tone: Tone;
}

/** The one place a bounty's phase is derived. Labels map to real protocol state, never to a guess. */
export function bountyPhase(b: Bounty, now: number): Phase {
  if (b.pendingCount > 0) return { bucket: "review", label: "Jury review", tone: "amber" };
  if (b.status === "CANCELLED") return { bucket: "settled", label: "Cancelled", tone: "red" };
  if (b.status === "DEPLETED") return { bucket: "settled", label: "Settled", tone: "gray" };
  if (now > b.deadline) return { bucket: "settled", label: "Closed", tone: "gray" };
  if (b.claimCount === 0) return { bucket: "accepting", label: "Rubric locked", tone: "gold" };
  return { bucket: "accepting", label: "Accepting reports", tone: "green" };
}

export type StatusFilter = "all" | BucketId;

export const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "accepting", label: "Accepting reports" },
  { id: "review", label: "Jury review" },
  { id: "settled", label: "Settled / closed" },
];

export function matchesStatus(b: Bounty, f: StatusFilter, now: number): boolean {
  return f === "all" || bountyPhase(b, now).bucket === f;
}

/**
 * Case-insensitive search. A purely numeric query (`7` or `#7`) matches the bounty id only; anything else searches the
 * title, repository, rubric text and, from four characters up, the project address (hex digits would otherwise match everything).
 */
export function searchBounties(list: Bounty[], query: string): Bounty[] {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (q === "") return list;
  if (/^\d+$/.test(q)) return list.filter((b) => String(b.id) === q);
  return list.filter(
    (b) =>
      b.title.toLowerCase().includes(q) ||
      (q.length >= 4 && b.project.includes(q)) ||
      b.repoUrl.toLowerCase().includes(q) ||
      b.rubric.toLowerCase().includes(q),
  );
}

export type SortKey = "newest" | "pool" | "closing" | "claims";

export const SORTS: { id: SortKey; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "pool", label: "Largest pool" },
  { id: "closing", label: "Closing soon" },
  { id: "claims", label: "Most claims" },
];

export function sortBounties(list: Bounty[], key: SortKey, now: number): Bounty[] {
  const out = [...list];
  switch (key) {
    case "pool":
      return out.sort((a, b) => (a.pool === b.pool ? b.id - a.id : a.pool > b.pool ? -1 : 1));
    case "claims":
      return out.sort((a, b) => b.claimCount - a.claimCount || b.id - a.id);
    case "closing": {
      // open bounties first, soonest deadline first; closed ones last
      const open = (b: Bounty) => b.deadline > now && b.status === "OPEN";
      return out.sort((a, b) => Number(open(b)) - Number(open(a)) || a.deadline - b.deadline || b.id - a.id);
    }
    default:
      return out.sort((a, b) => b.id - a.id);
  }
}

/** A short scope line taken from the bounty's own frozen "In scope" section. */
export function scopeExcerpt(rubric: string, max = 130): string {
  const section = splitRubric(rubric).find((s) => s.label.toLowerCase() === "in scope") ?? splitRubric(rubric)[0];
  const text = (section?.body ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

/** How full a bounty is: claims used out of the contract's 40-claim cap. */
export const MAX_CLAIMS = 40;
export const claimFill = (b: Bounty): number => Math.min(100, Math.round((b.claimCount / MAX_CLAIMS) * 100));

export interface Standing {
  label: string;
  tone: Tone;
}

/**
 * A researcher's claim, in the protocol's own terms. RESOLVED is provisional until the resolve transaction finalizes,
 * so "Accepted" means the jury accepted it and the payout is scheduled, not that GEN has already moved.
 */
export function claimStanding(c: Claim): Standing {
  if (c.status === "PENDING") return { label: "Under review", tone: "amber" };
  if (c.payout > 0n) return { label: "Accepted", tone: "green" };
  if (c.bondOutcome === "SLASHED") return { label: "Rejected", tone: "red" };
  if (c.evidenceAvailable === false) return { label: "No evidence", tone: "gray" };
  if (c.duplicateOf !== null) return { label: "Duplicate", tone: "gray" };
  return { label: "Below bar", tone: "gray" };
}

export interface Totals {
  paid: bigint;
  bondsHeld: bigint;
  bondsReturned: bigint;
  bondsSlashed: bigint;
}

/** Money a researcher has at stake or settled, from their own claims. */
export function claimTotals(claims: Claim[]): Totals {
  const t: Totals = { paid: 0n, bondsHeld: 0n, bondsReturned: 0n, bondsSlashed: 0n };
  for (const c of claims) {
    t.paid += c.payout;
    if (c.status === "PENDING") t.bondsHeld += c.bond;
    else if (c.bondOutcome === "RETURNED") t.bondsReturned += c.bond;
    else if (c.bondOutcome === "SLASHED") t.bondsSlashed += c.bond;
  }
  return t;
}

export interface Stats {
  totalBounties: number;
  acceptingBounties: number;
  claimsJudged: number;
  claimsTotal: number;
  gen: bigint;
}

/** Figures for the homepage, from the bounties the page actually loaded. Nothing is estimated or invented. */
export function protocolStats(items: Bounty[], total: number, now: number): Stats {
  return {
    totalBounties: total,
    acceptingBounties: items.filter((b) => b.status === "OPEN" && b.deadline > now && b.pool > 0n).length,
    claimsTotal: items.reduce((a, b) => a + b.claimCount, 0),
    claimsJudged: items.reduce((a, b) => a + (b.claimCount - b.pendingCount), 0),
    gen: items.reduce((a, b) => a + b.pool, 0n),
  };
}
