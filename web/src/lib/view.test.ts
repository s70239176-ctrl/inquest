import test from "node:test";
import assert from "node:assert/strict";
import { bountyPhase, claimStanding, claimTotals, matchesStatus, protocolStats, queueState, scopeExcerpt, searchBounties, sortBounties } from "./view.ts";
import type { Bounty, Claim } from "./types.ts";

const NOW = 1_800_000_000;
const bounty = (o: Partial<Bounty> = {}): Bounty => ({
  id: 1, project: "0xabc", title: "tinyparse bounty", repoUrl: "https://github.com/acme/tinyparse",
  rubric: "In scope: memory-safety bugs in the parser.\n\nOut of scope: denial of service.\n\nDuplicates: same cause.\n\nSeverity bars: low = crash.",
  lowPayout: 1n, mediumPayout: 3n, highPayout: 10n, bond: 1n, deadline: NOW + 86400, createdAt: NOW - 100, status: "OPEN",
  pool: 100n, slashed: 0n, reserved: 0n, headClaimId: 0, claimIds: [], acceptedIds: [], claimCount: 0, pendingCount: 0, withdrawable: 0n, ...o,
});
const claim = (o: Partial<Claim> = {}): Claim => ({
  id: 1, bountyId: 1, researcher: "0xr", url: "https://a.b/c", evidenceHash: "a".repeat(64), bond: 5n, status: "RESOLVED", evidenceAvailable: true,
  demonstrated: true, inScope: true, duplicateOf: null, severity: "high", payout: 10n, bondOutcome: "RETURNED", evidenceState: "ok", note: "", attempts: 0, lastAttemptAt: 0, expiresAt: 1_000_000, createdAt: 1, resolvedAt: 2, ...o,
});

test("bounty phases come from contract fields only", () => {
  assert.deepEqual(bountyPhase(bounty(), NOW), { bucket: "accepting", label: "Rubric locked", tone: "gold" });
  assert.equal(bountyPhase(bounty({ claimCount: 2 }), NOW).label, "Accepting reports");
  assert.equal(bountyPhase(bounty({ claimCount: 2, pendingCount: 1 }), NOW).label, "Jury review");
  assert.equal(bountyPhase(bounty({ status: "DEPLETED" }), NOW).label, "Settled");
  assert.equal(bountyPhase(bounty({ status: "CANCELLED" }), NOW).label, "Cancelled");
  assert.equal(bountyPhase(bounty({ deadline: NOW - 1 }), NOW).label, "Closed");
  // a waiting claim outranks an expired deadline: the jury still has work to do
  assert.equal(bountyPhase(bounty({ deadline: NOW - 1, pendingCount: 1 }), NOW).bucket, "review");
});

test("status filters", () => {
  const list = [bounty({ id: 1 }), bounty({ id: 2, pendingCount: 1 }), bounty({ id: 3, status: "DEPLETED" })];
  const ids = (f: "all" | "accepting" | "review" | "settled") => list.filter((b) => matchesStatus(b, f, NOW)).map((b) => b.id);
  assert.deepEqual(ids("all"), [1, 2, 3]);
  assert.deepEqual(ids("accepting"), [1]);
  assert.deepEqual(ids("review"), [2]);
  assert.deepEqual(ids("settled"), [3]);
});

test("search covers title, id, project, repo and rubric", () => {
  const list = [bounty({ id: 7, title: "Alpha", project: "0xdeadbeef" }), bounty({ id: 8, title: "Beta", repoUrl: "https://gitlab.com/x/y", rubric: "In scope: rust crate" })];
  assert.equal(searchBounties(list, "alpha").length, 1);
  assert.equal(searchBounties(list, "#8")[0].title, "Beta");
  assert.equal(searchBounties(list, "7")[0].title, "Alpha");
  assert.equal(searchBounties(list, "7").length, 1);
  assert.equal(searchBounties([bounty({ id: 3, project: "0x1abc1" })], "#1").length, 0, "digits match ids, not address characters");
  assert.equal(searchBounties(list, "deadbeef")[0].id, 7);
  assert.equal(searchBounties(list, "gitlab")[0].id, 8);
  assert.equal(searchBounties(list, "rust")[0].id, 8);
  assert.equal(searchBounties(list, "  ").length, 2);
  assert.equal(searchBounties(list, "nomatch").length, 0);
});

test("sorting", () => {
  const list = [
    bounty({ id: 1, pool: 50n, claimCount: 5, deadline: NOW + 500 }),
    bounty({ id: 2, pool: 90n, claimCount: 1, deadline: NOW + 100 }),
    bounty({ id: 3, pool: 90n, claimCount: 9, deadline: NOW - 10, status: "OPEN" }),
  ];
  const order = (k: "newest" | "pool" | "closing" | "claims") => sortBounties(list, k, NOW).map((b) => b.id);
  assert.deepEqual(order("newest"), [3, 2, 1]);
  assert.deepEqual(order("pool"), [3, 2, 1]);
  assert.deepEqual(order("claims"), [3, 1, 2]);
  assert.deepEqual(order("closing"), [2, 1, 3]); // expired last
});

test("scope excerpt is the frozen In scope text, truncated", () => {
  assert.equal(scopeExcerpt(bounty().rubric), "memory-safety bugs in the parser.");
  assert.ok(scopeExcerpt("In scope: " + "x".repeat(300), 50).length <= 50);
  assert.equal(scopeExcerpt("free text, no sections"), "free text, no sections");
});

test("claim standing uses the protocol's own outcome", () => {
  assert.equal(claimStanding(claim({ status: "PENDING", payout: 0n })).label, "Under review");
  assert.equal(claimStanding(claim()).label, "Accepted");
  assert.equal(claimStanding(claim({ payout: 0n, bondOutcome: "SLASHED" })).label, "Rejected");
  assert.equal(claimStanding(claim({ payout: 0n, evidenceAvailable: false })).label, "No evidence");
  assert.equal(claimStanding(claim({ payout: 0n, duplicateOf: 4 })).label, "Duplicate");
  assert.equal(claimStanding(claim({ payout: 0n, severity: "none" })).label, "Below bar");
});

test("claim totals", () => {
  const t = claimTotals([
    claim({ payout: 10n, bond: 5n }),
    claim({ payout: 0n, bond: 5n, bondOutcome: "SLASHED" }),
    claim({ status: "PENDING", payout: 0n, bond: 7n, bondOutcome: "NONE" }),
  ]);
  assert.deepEqual(t, { paid: 10n, bondsHeld: 7n, bondsReturned: 5n, bondsSlashed: 5n });
});

test("protocol stats are computed from real bounty fields", () => {
  const s = protocolStats(
    [
      bounty({ id: 1, pool: 40n, claimCount: 3, pendingCount: 1 }),
      bounty({ id: 2, pool: 60n, claimCount: 2, status: "DEPLETED" }),
      bounty({ id: 3, pool: 5n, deadline: NOW - 5 }),
    ],
    9,
    NOW,
  );
  assert.deepEqual(s, { totalBounties: 9, acceptingBounties: 1, claimsTotal: 5, claimsJudged: 4, gen: 105n });
});

test("v2 standings: expired, changed, withdrawn, retrying and bounty-full are named for what happened", () => {
  assert.equal(claimStanding(claim({ status: "EXPIRED", payout: 0n, bondOutcome: "RETURNED", evidenceState: "expired", note: "expired" })).label, "Expired");
  assert.equal(claimStanding(claim({ status: "PENDING", attempts: 1, payout: 0n, bondOutcome: "NONE" })).label, "Page unreachable, retrying");
  assert.equal(claimStanding(claim({ payout: 0n, bondOutcome: "SLASHED", evidenceState: "changed", note: "evidence_changed" })).label, "Evidence changed");
  assert.equal(claimStanding(claim({ payout: 0n, bondOutcome: "SLASHED", evidenceState: "withdrawn", note: "evidence_withdrawn" })).label, "Evidence withdrawn");
  assert.equal(claimStanding(claim({ payout: 0n, note: "bounty_full" })).label, "Bounty full");
  // a genuine rejection is still "Rejected", distinct from a changed or withdrawn page
  assert.equal(claimStanding(claim({ payout: 0n, bondOutcome: "SLASHED", demonstrated: false })).label, "Rejected");
});

test("queue: only the oldest pending claim can be resolved; retries wait; expiry unblocks", () => {
  const head = claim({ id: 3, status: "PENDING", payout: 0n, bondOutcome: "NONE", expiresAt: NOW + 1000 });
  const later = claim({ id: 4, status: "PENDING", payout: 0n, bondOutcome: "NONE", expiresAt: NOW + 1000 });
  assert.deepEqual(queueState(head, 3, 3600, NOW), { state: "head", waitSeconds: 0 });
  assert.deepEqual(queueState(later, 3, 3600, NOW), { state: "waiting", waitSeconds: 0 });
  const retrying = claim({ id: 3, status: "PENDING", attempts: 1, lastAttemptAt: NOW - 600, payout: 0n, bondOutcome: "NONE", expiresAt: NOW + 100000 });
  assert.deepEqual(queueState(retrying, 3, 3600, NOW), { state: "retry-wait", waitSeconds: 3000 });
  assert.equal(queueState(retrying, 3, 3600, NOW + 3000).state, "head");
  const stale = claim({ id: 3, status: "PENDING", payout: 0n, bondOutcome: "NONE", expiresAt: NOW - 1 });
  assert.equal(queueState(stale, 3, 3600, NOW).state, "expirable");
  assert.equal(queueState(claim({ status: "RESOLVED" }), 0, 3600, NOW).state, "done");
});
