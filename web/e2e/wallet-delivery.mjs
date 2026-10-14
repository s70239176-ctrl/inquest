// Recipient-wallet delivery proof. Runs the four payment paths against a REAL network and reads the recipients' own
// account balances before and after each finalized transfer:
//
//   1. researcher reward + bond refund  (resolve_claim, accepted high finding)
//   2. bond refund only                 (resolve_claim, duplicate)
//   3. bounty cancellation              (cancel)
//   4. project withdrawal               (withdraw after the deadline)
//
// On Studionet fresh throwaway keys are enough (transactions are gasless). On a testnet it needs funded accounts:
//
//   cd web
//   INQUEST_CHAIN=testnetBradbury PROJECT_KEY=0x... RESEARCHER_KEY=0x... \
//     FIXTURE_BASE=https://raw.githubusercontent.com/<owner>/inquest/<branch>/fixtures/tinyparse/ \
//     node --experimental-strip-types e2e/wallet-delivery.mjs
//
// Requirements: PROJECT_KEY holds about 0.6 GEN (pools of 0.4 GEN, returned or paid out) plus fees; RESEARCHER_KEY holds
// about 0.01 GEN plus fees. Keys are read from the environment only and never printed or written.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAccount } from "genlayer-js";
import { balanceOf, chain, clientFor, freshKey, paced, returnOf, sleep, view, write } from "../scripts/chain-lib.mjs";
import { fingerprintUrl } from "../src/lib/fingerprint.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const FIX = process.env.FIXTURE_BASE ?? "https://raw.githubusercontent.com/s70239176-ctrl/inquest/main/fixtures/tinyparse/";
const projectKey = process.env.PROJECT_KEY ?? freshKey();
const researcherKey = process.env.RESEARCHER_KEY ?? freshKey();
const funded = Boolean(process.env.PROJECT_KEY && process.env.RESEARCHER_KEY);

const GEN = 10n ** 18n;
const LOW = GEN / 100n, MED = (3n * GEN) / 100n, HIGH = GEN / 10n, BOND = GEN / 2000n;
const RUBRIC =
  "In scope: memory-safety bugs in the tinyparse C library's header and body parsers (heap or stack overflow, out-of-bounds read or write, use after free).\n\n" +
  "Out of scope: denial of service through large or slow inputs, resource exhaustion, documentation, build scripts.\n\n" +
  "Duplicates: two reports with the same faulty code and the same root cause are duplicates even if worded differently.\n\n" +
  "Severity bars: low = crash or null dereference on crafted input; medium = out-of-bounds read that discloses memory; high = out-of-bounds write or anything giving code execution.";

const project = clientFor(projectKey);
const researcher = clientFor(researcherKey);
const anyone = project; // the project pays the resolve fees, so the researcher's balance moves ONLY by the transfers under test
const reader = clientFor();
const addr = (k) => createAccount(k).address;
const P = addr(projectKey), R = addr(researcherKey);
const stamp = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(stamp(), ...a);
const fmt = (wei) => `${wei} wei (${(Number(wei) / 1e18).toFixed(6)} GEN)`;

const rows = [];
const txs = [];
const rec = (label, r) => txs.push({ label, hash: r.hash, status: r.status, revert: r.revert ?? null });
function verdict(id, name, ok, detail) {
  rows.push({ id, name, ok, detail });
  console.log(`${stamp()} ${ok ? "DELIVERED    " : "NOT DELIVERED"} [${id}] ${name} - ${detail}`);
}

log(`network ${chain.name}; project ${P}; researcher ${R}; funded accounts supplied: ${funded}`);
const startP = await balanceOf(reader, P);
const startR = await balanceOf(reader, R);
log(`starting balances: project ${fmt(startP)}, researcher ${fmt(startR)}`);
if (funded && (startP < 6n * GEN / 10n || startR < GEN / 100n)) {
  console.error("Accounts are underfunded for this run (project needs ~0.6 GEN, researcher ~0.01 GEN plus fees).");
  process.exit(2);
}

// ---- deploy with short windows
const code = readFileSync(join(root, "contracts", "inquest.py"), "utf8");
const dh = await paced(() => project.deployContract({ code, args: [60n, 2n, 3600n] }));
let CONTRACT, deployTx;
for (let i = 0; i < 80 && !CONTRACT; i++) {
  await sleep(8000);
  const tx = await paced(() => project.request({ method: "eth_getTransactionByHash", params: [dh] }));
  if (["ACCEPTED", "FINALIZED"].includes(tx?.status)) {
    CONTRACT = tx.data?.contract_address ?? tx.to_address;
    deployTx = tx;
  }
  if (["UNDETERMINED", "CANCELED"].includes(tx?.status)) throw new Error("deploy " + tx.status);
}
if (!CONTRACT) throw new Error("deploy timed out");
log("contract", CONTRACT, "deploy tx", dh);

const W = (client, fn, args, value = 0n, wait = "ACCEPTED") => write(client, CONTRACT, fn, args, value, wait);
const chainTime = async () => Number(BigInt((await paced(() => reader.request({ method: "eth_getBlockByNumber", params: ["latest", false] }))).timestamp));

/** Wait (up to ms) for the account balance to change from `before`, then return it. */
async function settledBalance(address, before, ms = 12 * 60 * 1000) {
  const t0 = Date.now();
  let b = await balanceOf(reader, address);
  while (b === before && Date.now() - t0 < ms) {
    await sleep(10000);
    b = await balanceOf(reader, address);
  }
  return b;
}

const url = (n) => FIX + n;
const hashHigh = (await fingerprintUrl(url("01-high-heap-overflow.md"))).hash;
const hashDup = (await fingerprintUrl(url("03-duplicate-of-high.md"))).hash;

// ================= 1 + 2: researcher reward + bond refund, then bond refund only =================
const b1 = await W(project, "create_bounty", ["Wallet delivery 1", "https://github.com/acme/tinyparse", RUBRIC, LOW, MED, HIGH, BigInt((await chainTime()) + 7 * 86400), BOND], 2n * HIGH);
rec("create_bounty(1)", b1);
const bid1 = BigInt(returnOf(b1.tx).id);
const c1 = await W(researcher, "submit_claim", [bid1, url("01-high-heap-overflow.md"), hashHigh], BOND);
rec("submit_claim(original)", c1);
const claim1 = BigInt(returnOf(c1.tx).id);
// the duplicate must come from a different researcher than the original: supply a second funded account as DUP_KEY
const dupKey = process.env.DUP_KEY;
let claim2 = null;
if (dupKey) {
  const d = await W(clientFor(dupKey), "submit_claim", [bid1, url("03-duplicate-of-high.md"), hashDup], BOND);
  rec("submit_claim(duplicate)", d);
  claim2 = BigInt(returnOf(d.tx).id);
}

const before1 = await balanceOf(reader, R);
const r1 = await W(anyone, "resolve_claim", [claim1], 0n, "FINALIZED");
rec("resolve_claim(original)", r1);
const after1 = await settledBalance(R, before1);
const claimRead = await view(reader, CONTRACT, "get_claim", [claim1]);
log("claim read back:", JSON.stringify(claimRead, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
const expect1 = HIGH + BOND;
verdict("1", "researcher reward + bond refund reach the researcher's own wallet", after1 - before1 === expect1, `balance ${fmt(before1)} -> ${fmt(after1)}; expected +${fmt(expect1)}; resolve tx ${r1.status}`);

if (claim2 !== null) {
  const dupAddr = addr(dupKey);
  const beforeD = await balanceOf(reader, dupAddr);
  const r2 = await W(anyone, "resolve_claim", [claim2], 0n, "FINALIZED");
  rec("resolve_claim(duplicate)", r2);
  const afterD = await settledBalance(dupAddr, beforeD);
  verdict("2", "bond refund (duplicate, no reward) reaches the researcher's wallet", afterD - beforeD === BOND, `balance ${fmt(beforeD)} -> ${fmt(afterD)}; expected +${fmt(BOND)}`);
} else {
  verdict("2", "bond refund (duplicate, no reward) reaches the researcher's wallet", false, "not run: pass DUP_KEY (a second funded account) to exercise this path");
}

// ================= 3: bounty cancellation =================
const b3 = await W(project, "create_bounty", ["Wallet delivery cancel", "https://github.com/acme/tinyparse", RUBRIC, LOW, MED, HIGH, BigInt((await chainTime()) + 7 * 86400), BOND], HIGH);
rec("create_bounty(cancel)", b3);
const bid3 = BigInt(returnOf(b3.tx).id);
const before3 = await balanceOf(reader, P);
const x = await W(project, "cancel", [bid3], 0n, "FINALIZED");
rec("cancel", x);
const after3 = await settledBalance(P, before3);
// the project paid the cancel transaction's own fee, so allow for it: the refund is HIGH minus that fee
verdict("3", "bounty cancellation returns the pool to the project's wallet", after3 > before3 && after3 - before3 <= HIGH && HIGH - (after3 - before3) < GEN / 100n, `balance ${fmt(before3)} -> ${fmt(after3)}; pool ${fmt(HIGH)} (difference is the cancel transaction's own fee)`);

// ================= 4: project withdrawal after the deadline =================
const b4 = await W(project, "create_bounty", ["Wallet delivery withdraw", "https://github.com/acme/tinyparse", RUBRIC, LOW, MED, HIGH, BigInt((await chainTime()) + 150), BOND], HIGH);
rec("create_bounty(withdraw)", b4);
const bid4 = BigInt(returnOf(b4.tx).id);
log("waiting for the 150 s deadline");
await sleep(190000);
const before4 = await balanceOf(reader, P);
const w = await W(project, "withdraw", [bid4], 0n, "FINALIZED");
rec("withdraw", w);
const after4 = await settledBalance(P, before4);
verdict("4", "project withdrawal reaches the project's wallet", after4 > before4 && HIGH - (after4 - before4) < GEN / 100n, `balance ${fmt(before4)} -> ${fmt(after4)}; withdrawable ${fmt(HIGH)} (difference is the withdraw transaction's own fee)`);

// ================= ledger of failed payments =================
const failedTotal = await view(reader, CONTRACT, "get_failed_total", []);
const contractBal = await balanceOf(reader, CONTRACT);
verdict("L", "no outgoing transfer failed (failed-payment ledger is empty)", BigInt(failedTotal) === 0n, `get_failed_total ${failedTotal}; contract balance ${fmt(contractBal)}`);

// ------------------------------------------------------------------ report
const delivered = rows.filter((r) => r.ok).length;
let md = `# Recipient-wallet delivery report\n\n`;
md += `- Network: ${chain.name}\n- Contract: \`${CONTRACT}\` (deploy tx \`${dh}\`)\n- Project: \`${P}\`\n- Researcher: \`${R}\`\n`;
md += `- Funded accounts supplied by the operator: ${funded ? "yes" : "no (throwaway keys)"}\n`;
md += `- Result: **${delivered}/${rows.length} paths delivered to the recipient's own balance**\n\n`;
md += `| Path | Check | Result | Balances |\n| --- | --- | --- | --- |\n`;
for (const r of rows) md += `| ${r.id} | ${r.name} | ${r.ok ? "DELIVERED" : "NOT DELIVERED"} | ${r.detail.replace(/\|/g, "\\|")} |\n`;
md += `\n## Transactions\n\n| Step | Status | Revert | Hash |\n| --- | --- | --- | --- |\n`;
for (const t of txs) md += `| ${t.label} | ${t.status} | ${t.revert ?? ""} | \`${t.hash}\` |\n`;
const out = join(root, "docs", `WALLET-DELIVERY-${chain.name.replace(/\W+/g, "-")}.md`);
writeFileSync(out, md);
console.log(`\n${delivered}/${rows.length} delivered. Report: ${out}`);
process.exit(delivered === rows.length ? 0 : 1);
