// Live end-to-end suite on Studionet. Deploys a fresh contract, then plays every spec scenario against REAL
// validators, a REAL page fetch and REAL GEN accounting (the contract's own balance). Writes docs/E2E-REPORT.md.
//
//   cd web && node e2e/live.mjs            (takes ~30-45 minutes; Studionet allows ~30 RPC calls/min)
//
// A check FAILS honestly when the live jury disagrees with the fixture's ground truth: nothing here is mocked.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addressOf, balanceOf, clientFor, freshKey, paced, revertOf, sleep, view, write } from "../scripts/chain-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const FIX = process.env.FIXTURE_BASE ?? "https://raw.githubusercontent.com/s70239176-ctrl/inquest/main/fixtures/tinyparse/";
const U = {
  high: FIX + "01-high-heap-overflow.md",
  medium: FIX + "02-medium-oob-read.md",
  dup: FIX + "03-duplicate-of-high.md",
  dos: FIX + "04-out-of-scope-dos.md",
  inject: FIX + "05-injection.md",
  dead: "https://this-host-does-not-exist.inquest-e2e.example/report",
};
const LOW = 1000n, MED = 3000n, HIGH = 10000n, BOND = 100n;
const RUBRIC =
  "In scope: memory-safety bugs in the tinyparse C library's header and body parsers (heap or stack overflow, out-of-bounds read or write, use after free).\n\n" +
  "Out of scope: denial of service through large or slow inputs, resource exhaustion, documentation, build scripts, and anything requiring local write access.\n\n" +
  "Duplicates: two reports with the same faulty code and the same root cause are duplicates even if worded differently. Same symptom with a different cause is not a duplicate.\n\n" +
  "Severity bars: low = crash or null dereference on crafted input; medium = out-of-bounds read that discloses memory; high = out-of-bounds write or anything giving code execution.";

// ------------------------------------------------------------------ reporting
const started = new Date();
const checks = [];
const txs = [];
const notes = [];
const stamp = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(stamp(), ...a);
function check(id, name, ok, detail = "") {
  checks.push({ id, name, ok: !!ok, detail });
  console.log(`${stamp()} ${ok ? "PASS" : "FAIL"}  [${id}] ${name}${detail ? "  — " + detail : ""}`);
}
const recordTx = (label, r) => txs.push({ label, hash: r.hash, status: r.status, revert: r.revert ?? null });

// ------------------------------------------------------------------ chain helpers
const reader = clientFor();
const keys = new Map();
const who = (name) => {
  if (!keys.has(name)) keys.set(name, freshKey());
  return { key: keys.get(name), client: clientFor(keys.get(name)), address: addressOf(keys.get(name)).toLowerCase() };
};
let CONTRACT;
const call = (name) => (fn, args, value = 0n, waitFor = "ACCEPTED", onStatus) =>
  write(who(name).client, CONTRACT, fn, args, value, waitFor, onStatus);
const bal = () => balanceOf(reader, CONTRACT);
const big = (v) =>
  typeof v === "number" ? BigInt(v)
  : Array.isArray(v) ? v.map(big)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, big(x)]))
  : v;
const V = async (fn, args) => big(await view(reader, CONTRACT, fn, args));
const getBounty = async (id) => V("get_bounty", [BigInt(id)]);
const getClaim = async (id) => V("get_claim", [BigInt(id)]);

async function waitBalance(expected, label, ms = 150000) {
  const t0 = Date.now();
  let b = await bal();
  while (b !== expected && Date.now() - t0 < ms) {
    await sleep(8000);
    b = await bal();
  }
  return b;
}

async function deploy() {
  const code = readFileSync(join(root, "contracts", "inquest.py"), "utf8");
  const c = clientFor(freshKey());
  const hash = await paced(() => c.deployContract({ code, args: [] }));
  for (let i = 0; i < 60; i++) {
    await sleep(8000);
    const tx = await paced(() => c.request({ method: "eth_getTransactionByHash", params: [hash] }));
    if (["ACCEPTED", "FINALIZED"].includes(tx?.status)) {
      const addr = tx.data?.contract_address ?? tx.to_address;
      if (!addr) throw new Error("no contract address");
      return { address: addr, hash };
    }
    if (["UNDETERMINED", "CANCELED"].includes(tx?.status)) throw new Error("deploy " + tx.status);
  }
  throw new Error("deploy timed out");
}

async function chainTime() {
  const b = await paced(() => reader.request({ method: "eth_getBlockByNumber", params: ["latest", false] }));
  return Number(BigInt(b.timestamp));
}

async function createBounty(name, { pool, deadlineIn, title }) {
  const now = await chainTime();
  const before = await bal();
  const r = await call(name)("create_bounty", [title, "https://github.com/acme/tinyparse", RUBRIC, LOW, MED, HIGH, BigInt(now + deadlineIn), BOND], pool);
  recordTx(`create_bounty(${title})`, r);
  if (r.revert !== null || !["ACCEPTED", "FINALIZED"].includes(r.status)) throw new Error(`create failed: ${r.status} ${r.revert}`);
  const list = await V("list_bounties", [0n, 1n]);
  const id = Number(list.items[0].id);
  const after = await bal();
  return { id, deposited: after - before };
}

async function submit(name, bountyId, url) {
  const before = await bal();
  const r = await call(name)("submit_claim", [BigInt(bountyId), url], BOND);
  recordTx(`submit_claim(${url.split("/").pop().slice(0, 28)})`, r);
  const after = await bal();
  if (r.revert !== null) return { ok: false, revert: r.revert, locked: after - before, r };
  const claims = await V("list_claims", [BigInt(bountyId), addressOf(keys.get(name)).toLowerCase(), 0n, 1n]);
  return { ok: true, id: Number(claims.items[0].id), locked: after - before, r };
}

/** Resolve (anyone may). UNDETERMINED means the jury could not agree: nothing moved, so just try again. */
async function resolve(claimId, { finalize = true, attempts = 3 } = {}) {
  const trace = { attempts: 0, acceptedBalance: null, balanceBefore: await bal(), canAppealAtAccept: null };
  for (let i = 1; i <= attempts; i++) {
    trace.attempts = i;
    const r = await call("anyone")("resolve_claim", [BigInt(claimId)], 0n, finalize ? "FINALIZED" : "ACCEPTED", async (status) => {
      if (status === "ACCEPTED" && trace.acceptedBalance === null) trace.acceptedBalance = await bal();
    });
    recordTx(`resolve_claim #${claimId} (attempt ${i})`, r);
    trace.r = r;
    if (r.status === "UNDETERMINED") {
      const c = await getClaim(claimId);
      notes.push(`claim ${claimId}: jury UNDETERMINED on attempt ${i}; claim status ${c.status}, balance unchanged`);
      if (c.status !== "PENDING") break;
      continue;
    }
    break;
  }
  return trace;
}

const fields = (c) =>
  `evidence=${c.evidence_available} demonstrated=${c.demonstrated} in_scope=${c.in_scope} dup=${c.duplicate_of} severity=${c.severity} payout=${c.payout} bond=${c.bond_outcome}`;

// ================================================================== run
log("deploying a fresh Inquest contract to Studionet");
const dep = await deploy();
CONTRACT = dep.address;
log("contract", CONTRACT);
check("D0", "contract deploys on Studionet and answers views", (await V("list_bounties", [0n, 5n])).total === 0n);

// ---- short-deadline bounty first so its clock runs while everything else happens
const sd = await createBounty("p_deadline", { pool: HIGH, deadlineIn: 420, title: "Deadline bounty" });
const sdClaim = await submit("r_deadline", sd.id, U.dead);
check("12a", "claim submitted before the deadline is accepted", sdClaim.ok, `claim ${sdClaim.id}`);
const sdCreatedAt = Date.now();

// ================= 1-6: main bounty =================
const main = await createBounty("p_main", { pool: 14000n, deadlineIn: 3 * 86400, title: "Main bounty" });
check("C1", "create_bounty locks the attached pool in the contract", main.deposited === 14000n, `balance +${main.deposited}`);
let mb = await getBounty(main.id);
check("C2", "frozen fields stored; status OPEN", mb.status === "OPEN" && mb.pool === 14000n && mb.bond === BOND && mb.high_payout === HIGH);

// ---- 2. in-scope HIGH is paid, only on finalization
const A = await submit("r1", main.id, U.high);
check("S1", "claim submission pays nothing and creates a PENDING claim", A.ok && (await getClaim(A.id)).status === "PENDING" && A.locked === BOND, `bond locked +${A.locked}`);
const tA = await resolve(A.id);
const cA = await getClaim(A.id);
log("claim A:", fields(cA));
check("2a", "in-scope high writeup is judged demonstrated/in-scope/original/high", cA.status === "RESOLVED" && cA.demonstrated && cA.in_scope && cA.duplicate_of === null && cA.severity === "high", fields(cA));
check("2b", "payout equals the high band and the bond is returned", cA.payout === HIGH && cA.bond_outcome === "RETURNED");
const expectA = tA.balanceBefore - (HIGH + BOND);
check("2c", "NO GEN moves while the resolve tx is only ACCEPTED (provisional)", tA.acceptedBalance === null || tA.acceptedBalance === tA.balanceBefore, `before ${tA.balanceBefore}, at accept ${tA.acceptedBalance}`);
const finalA = await waitBalance(expectA, "A");
check("2d", "GEN moves on FINALIZATION: contract balance drops by payout + returned bond", finalA === expectA, `before ${tA.balanceBefore} -> after ${finalA} (expected ${expectA})`);
mb = await getBounty(main.id);
check("2e", "pool decremented and the claim is recorded as accepted", mb.pool === 4000n && mb.accepted_ids.map(Number).includes(A.id), `pool ${mb.pool}`);

// ---- 5. duplicate
const B = await submit("r2", main.id, U.dup);
const tB = await resolve(B.id);
const cB = await getClaim(B.id);
log("claim B:", fields(cB));
check("5a", "a duplicate that calls itself novel is judged duplicate_of the earlier claim", cB.status === "RESOLVED" && Number(cB.duplicate_of) === A.id, fields(cB));
check("5b", "duplicate: no payout, bond returned", cB.payout === 0n && cB.bond_outcome === "RETURNED");
check("5c", "duplicate: pool unchanged", (await getBounty(main.id)).pool === 4000n);

// ---- 3/6. different cause: paid at its own band
const C = await submit("r3", main.id, U.medium);
const tC = await resolve(C.id);
const cC = await getClaim(C.id);
log("claim C:", fields(cC));
check("6a", "same area, different cause: not a duplicate, demonstrated and in scope", cC.status === "RESOLVED" && cC.duplicate_of === null && cC.demonstrated && cC.in_scope, fields(cC));
check("3a", "out-of-bounds READ clears the medium bar and is paid medium (not high)", cC.severity === "medium" && cC.payout === MED, fields(cC));

// ---- 4. out of scope
const D = await submit("r4", main.id, U.dos);
await resolve(D.id);
const cD = await getClaim(D.id);
log("claim D:", fields(cD));
check("4a", "real but excluded (DoS) is judged out of scope, no payout", cD.status === "RESOLVED" && !cD.in_scope && cD.payout === 0n, fields(cD));
check("4b", "out of scope: bond slashed to the project ledger", cD.bond_outcome === "SLASHED" && (await getBounty(main.id)).slashed >= BOND);

// ---- 1. injection
const E = await submit("r5", main.id, U.inject);
await resolve(E.id);
const cE = await getClaim(E.id);
log("claim E:", fields(cE));
check("1a", "injection page: never high, never paid", cE.status === "RESOLVED" && cE.severity !== "high" && cE.payout === 0n, fields(cE));
check("1b", "injection page: pool unaffected beyond the earlier payouts, bond slashed", cE.bond_outcome === "SLASHED");
mb = await getBounty(main.id);
check("1c", "pool after A (high) and C (medium) is exactly 14000-10000-3000", mb.pool === 1000n, `pool ${mb.pool}`);

// ---- 7. dead URL
const F = await submit("r6", main.id, U.dead);
await resolve(F.id);
const cF = await getClaim(F.id);
check("7a", "dead URL: evidence_available false, fields forced empty", cF.evidence_available === false && cF.demonstrated === false && cF.severity === "none", fields(cF));
check("7b", "dead URL: bond returned, never slashed", cF.bond_outcome === "RETURNED" && cF.payout === 0n);

// ---- submit-rule refusals (and what a refusal does to attached value)
const G = await submit("r7", main.id, U.dead);
const G2 = await submit("r7", main.id, U.dead);
check("R1", "a second claim while one is pending is refused with 'pending exists'", !G2.ok && G2.revert === "pending exists", `revert=${G2.revert}`);
await resolve(G.id);
const badUrl = await submit("r8", main.id, "http://insecure.example/x");
check("R2", "http:// URL refused with 'bad url'", !badUrl.ok && badUrl.revert === "bad url", `revert=${badUrl.revert}`);
notes.push(`Refused payable call: submit_claim(bad url) with ${BOND} attached changed the contract balance by ${badUrl.locked} wei` + (badUrl.locked === 0n ? " (value was NOT retained)." : " (value WAS retained by the contract: refusals keep attached value on this runtime; the UI therefore pre-validates before sending value)."));
check("R3", "refusal of a payable call does not strand attached value", badUrl.locked === 0n, `contract balance change ${badUrl.locked}`);

// ---- withdraw / cancel guards on the main bounty
const w0 = await call("p_main")("withdraw", [BigInt(main.id)]);
recordTx("withdraw(main) before deadline", w0);
check("W1", "withdraw before the deadline is refused ('nothing to withdraw')", w0.revert === "nothing to withdraw", `revert=${w0.revert}`);
const c0 = await call("p_main")("cancel", [BigInt(main.id)]);
recordTx("cancel(main) with claims", c0);
check("X1", "cancel after claims exist is refused ('has claims')", c0.revert === "has claims", `revert=${c0.revert}`);
const wx = await call("r1")("withdraw", [BigInt(main.id)]);
check("W2", "only the project can withdraw ('not project')", wx.revert === "not project", `revert=${wx.revert}`);

// ================= 13. live protocol appeal =================
log("appeal test: resolve a claim and appeal it while it is still only ACCEPTED");
const mid = await createBounty("p_appeal", { pool: HIGH, deadlineIn: 86400, title: "Appeal bounty" });
const X = await submit("r_appeal", mid.id, U.dead);
const appealBefore = await bal();
const rx = await call("anyone")("resolve_claim", [BigInt(X.id)], 0n, "ACCEPTED");
recordTx("resolve_claim for appeal test", rx);
let appealNote = "";
try {
  const ac = clientFor(freshKey());
  const can = await paced(() => ac.canAppeal({ txId: rx.hash }));
  appealNote += `canAppeal=${can}`;
  if (can) {
    const charge = await paced(() => ac.getMinAppealBond({ txId: rx.hash }));
    appealNote += ` charge=${charge}`;
    const ap = await paced(() => ac.appealTransaction({ txId: rx.hash, value: charge }));
    appealNote += ` appeal tx=${String(ap).slice(0, 18)}…`;
    check("13a", "a resolve tx is appealable while ACCEPTED and the protocol quotes a charge", true, appealNote);
    // follow the appealed round to its end
    let end;
    for (let i = 0; i < 110; i++) {
      await sleep(8000);
      end = await paced(() => reader.request({ method: "eth_getTransactionByHash", params: [rx.hash] }));
      if (end?.status === "FINALIZED" || ["UNDETERMINED", "CANCELED"].includes(end?.status)) break;
    }
    appealNote += ` final=${end?.status} appealed=${end?.appealed}`;
    const cx = await getClaim(X.id);
    const stable = await waitBalance(appealBefore - BOND, "appeal", 120000);
    check("13b", "after the appeal round the claim is resolved ONCE and the bond is paid back exactly once", cx.status === "RESOLVED" && stable === appealBefore - BOND, `${fields(cx)}; balance ${appealBefore} -> ${stable}`);
  } else {
    check("13a", "a resolve tx is appealable while ACCEPTED", false, appealNote + " (already outside the appeal window)");
  }
} catch (e) {
  check("13a", "protocol appeal can be filed on Studionet", false, `${e.shortMessage ?? e.message}`.slice(0, 220));
}
notes.push("appeal: " + appealNote);

// ================= 10. economy: pool == one high payout =================
const eco = await createBounty("p_eco", { pool: HIGH, deadlineIn: 86400, title: "Economy bounty" });
const e1 = await submit("e1", eco.id, U.inject);
await resolve(e1.id);
const e2 = await submit("e2", eco.id, U.high);
await resolve(e2.id);
const ce2 = await getClaim(e2.id);
const eb = await getBounty(eco.id);
check("10a", "pool equal to one high payout is emptied by one high finding -> DEPLETED", ce2.payout === HIGH && eb.status === "DEPLETED" && eb.pool === 0n, `${fields(ce2)}; status ${eb.status}`);
const e3 = await submit("e3", eco.id, U.dead);
check("10b", "a new claim on a depleted bounty is refused ('not open')", !e3.ok && e3.revert === "not open", `revert=${e3.revert}`);
const ledger = await V("get_ledger", [BigInt(eco.id)]);
check("10c", "slashed bond is withdrawable after depletion (ledger == bond)", ledger === BOND, `ledger ${ledger}`);
const beforeW = await bal();
const wr = await call("p_eco")("withdraw", [BigInt(eco.id)], 0n, "FINALIZED");
recordTx("withdraw(economy)", wr);
const afterW = await waitBalance(beforeW - BOND, "withdraw");
check("10d", "withdraw pays the slashed bond to the project, on finalization", wr.revert === null && afterW === beforeW - BOND, `balance ${beforeW} -> ${afterW}`);

// ================= 11. cancel =================
const cn = await createBounty("p_cancel", { pool: HIGH, deadlineIn: 86400, title: "Cancel bounty" });
const cx1 = await call("someone")("cancel", [BigInt(cn.id)]);
check("11a", "a stranger cannot cancel ('not project')", cx1.revert === "not project", `revert=${cx1.revert}`);
const beforeC = await bal();
const cr = await call("p_cancel")("cancel", [BigInt(cn.id)], 0n, "FINALIZED");
recordTx("cancel(no claims)", cr);
const afterC = await waitBalance(beforeC - HIGH, "cancel");
const cb = await getBounty(cn.id);
check("11b", "cancel with zero claims returns the full pool, on finalization", cr.revert === null && cb.status === "CANCELLED" && afterC === beforeC - HIGH, `balance ${beforeC} -> ${afterC}`);
const cs = await submit("r9", cn.id, U.dead);
check("11c", "claims on a cancelled bounty are refused", !cs.ok && cs.revert === "not open", `revert=${cs.revert}`);

// ================= 12. deadline =================
const wait = 420 * 1000 - (Date.now() - sdCreatedAt) + 45000;
if (wait > 0) {
  log(`waiting ${Math.round(wait / 1000)}s for the short deadline to pass`);
  await sleep(wait);
}
const late = await submit("r_late", sd.id, U.dead);
check("12b", "submit after the deadline is refused ('too late')", !late.ok && late.revert === "too late", `revert=${late.revert}`);
const wBlocked = await call("p_deadline")("withdraw", [BigInt(sd.id)]);
check("12c", "withdraw with a PENDING claim is refused even after the deadline", wBlocked.revert === "nothing to withdraw", `revert=${wBlocked.revert}`);
await resolve(sdClaim.id);
const beforeD = await bal();
const wd = await call("p_deadline")("withdraw", [BigInt(sd.id)], 0n, "FINALIZED");
recordTx("withdraw(deadline)", wd);
const afterD = await waitBalance(beforeD - HIGH, "deadline withdraw");
check("12d", "after the pending claim resolves, the leftover pool is withdrawable, on finalization", wd.revert === null && afterD === beforeD - HIGH, `balance ${beforeD} -> ${afterD}`);

// ================= conservation =================
const total = await bal();
let expected = 0n;
for (let id = 1; id <= 6; id++) {
  try {
    const b = await getBounty(id);
    expected += b.pool + b.slashed;
  } catch {
    break;
  }
}
const pendingBonds = BigInt(
  (await V("list_claims", [0n, "", 0n, 20n])).items.filter((c) => c.status === "PENDING").length,
) * BOND;
check("ACC", "conservation: contract balance == sum(pool + slashed) + pending bonds", total === expected + pendingBonds, `balance ${total}, pools+slashed ${expected}, pending bonds ${pendingBonds}`);

// ------------------------------------------------------------------ report
const failed = checks.filter((c) => !c.ok);
const finished = new Date();
let md = `# Live end-to-end report (Studionet)\n\n`;
md += `- Run: ${started.toISOString()} → ${finished.toISOString()} (${Math.round((finished - started) / 60000)} min)\n`;
md += `- Contract: \`${CONTRACT}\` (deploy tx \`${dep.hash}\`)\n`;
md += `- Fixtures: ${FIX}\n`;
md += `- Result: **${checks.length - failed.length}/${checks.length} checks passed**\n\n`;
md += `Nothing is mocked: validators fetched the fixture pages and ran their own models. GEN is verified through the contract's own balance (Studionet does not credit ordinary accounts).\n\n`;
md += `| ID | Check | Result | Detail |\n| --- | --- | --- | --- |\n`;
for (const c of checks) md += `| ${c.id} | ${c.name} | ${c.ok ? "PASS" : "**FAIL**"} | ${String(c.detail).replace(/\|/g, "\\|")} |\n`;
md += `\n## Notes\n\n${notes.map((n) => `- ${n}`).join("\n") || "- none"}\n`;
md += `\n## Transactions\n\n| Step | Status | Revert | Hash |\n| --- | --- | --- | --- |\n`;
for (const t of txs) md += `| ${t.label} | ${t.status} | ${t.revert ?? ""} | \`${t.hash}\` |\n`;
mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(join(root, "docs", "E2E-REPORT.md"), md);
writeFileSync(join(root, "docs", "e2e-last-run.json"), JSON.stringify({ contract: CONTRACT, started, finished, checks, notes, txs }, null, 2));
console.log(`\n${checks.length - failed.length}/${checks.length} passed. Report: docs/E2E-REPORT.md`);
process.exit(failed.length ? 1 : 0);
