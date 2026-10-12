import test from "node:test";
import assert from "node:assert/strict";
import { REFUSALS, TIME_DEPENDENT, decodeRevert, describeError, plain, refusalKey, toBounty, toClaim } from "./decode.ts";

const b64 = (tag: number, text: string) => Buffer.concat([Buffer.from([tag]), Buffer.from(text)]).toString("base64");

test("decodeRevert reads the contract's own refusal text", () => {
  assert.equal(decodeRevert(b64(1, "bad url")), "bad url");
  assert.equal(decodeRevert(b64(1, "pending exists")), "pending exists");
  assert.equal(decodeRevert(""), undefined);
  assert.equal(decodeRevert(undefined), undefined);
  assert.equal(decodeRevert(Buffer.from([1, 0, 255, 254]).toString("base64")), undefined);
});

test("every contract refusal has plain-language copy", () => {
  for (const key of [
    "empty pool", "bad title", "bad rubric", "bad url", "bad payouts", "bad deadline", "bad bond", "pool below high payout",
    "too late", "bond mismatch", "pending exists", "attempt limit", "claim limit", "not project", "nothing to withdraw",
    "already resolved", "not open", "has claims", "project cannot claim", "bad judgment",
  ]) {
    assert.ok(REFUSALS[key], key);
  }
  assert.ok(TIME_DEPENDENT.has("too late") && !TIME_DEPENDENT.has("bad url"));
});

test("describeError turns a dry-run receipt into the refusal copy", () => {
  const e = { cause: { data: { receipt: { result: b64(1, "bond mismatch") } } } };
  assert.equal(describeError(e), REFUSALS["bond mismatch"]);
  assert.equal(refusalKey(e), "bond mismatch");
  assert.match(describeError(new Error("User rejected the request.")), /declined/);
});

test("plain() flattens Maps and keeps bigints", () => {
  const m = new Map<string, unknown>([["a", 1n], ["b", new Map([["c", [new Map([["d", 2]])]]])]]);
  assert.deepEqual(plain(m), { a: 1n, b: { c: [{ d: 2 }] } });
});

const rawBounty = {
  id: 3, project: "0xAbC", title: "t", repo_url: "https://x.y/z", rubric: "r", low_payout: 1000, medium_payout: 3000n,
  high_payout: 10000, bond: 100, deadline: 1900000000, created_at: 1800000000, status: "OPEN", pool: 14000n, slashed: 0,
  claim_ids: [1, 2], accepted_ids: [1], claim_count: 2, pending_count: 1, withdrawable: 0,
};

test("toBounty decodes numbers and bigints alike", () => {
  const b = toBounty(rawBounty);
  assert.equal(b.project, "0xabc");
  assert.equal(b.highPayout, 10000n);
  assert.equal(b.pool, 14000n);
  assert.deepEqual(b.claimIds, [1, 2]);
  assert.equal(b.pendingCount, 1);
});

test("toClaim keeps unresolved verdict fields null", () => {
  const c = toClaim({
    id: 1, bounty_id: 3, researcher: "0xAA", url: "https://a.b/c", bond: 100, status: "PENDING", evidence_available: null,
    demonstrated: null, in_scope: null, duplicate_of: null, severity: null, payout: 0, bond_outcome: "NONE", created_at: 5, resolved_at: 0,
  });
  assert.equal(c.severity, null);
  assert.equal(c.demonstrated, null);
  assert.equal(c.duplicateOf, null);
  const r = toClaim({ ...{ id: 2, bounty_id: 3, researcher: "0xAA", url: "u", bond: 100, status: "RESOLVED", evidence_available: true,
    demonstrated: true, in_scope: true, duplicate_of: 1, severity: "none", payout: 0, bond_outcome: "RETURNED", created_at: 5, resolved_at: 9 } });
  assert.equal(r.duplicateOf, 1);
  assert.equal(r.bondOutcome, "RETURNED");
});
