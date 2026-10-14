// Recipient-balance delivery on Studionet using SMART-CONTRACT wallets.
//
// Studionet does not credit externally-owned accounts from contract-emitted transfers (measured), so the four payment
// paths cannot be shown reaching an EOA there. They CAN be shown reaching a contract that can receive value. This script
// deploys Inquest and three ProxyWallet contracts (tests/support/proxy_wallet.py): W1 acts as the project, W2 and W3 as
// researchers. Each wallet's own balance is read before and after each finalized transfer.
//
//   cd web && node --experimental-strip-types e2e/contract-wallet.mjs
//
// This is a stand-in for EOA delivery, not a replacement: web/e2e/wallet-delivery.mjs does the EOA version on a testnet.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addressOf, balanceOf, clientFor, freshKey, paced, sleep, view, write } from "../scripts/chain-lib.mjs";
import { fingerprintUrl } from "../src/lib/fingerprint.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const FIX = process.env.FIXTURE_BASE ?? "https://raw.githubusercontent.com/s70239176-ctrl/inquest/main/fixtures/tinyparse/";
const LOW = 1000n, MED = 3000n, HIGH = 10000n, BOND = 100n;
const RUBRIC =
  "In scope: memory-safety bugs in the tinyparse C library's header and body parsers (heap or stack overflow, out-of-bounds read or write, use after free).\n\n" +
  "Out of scope: denial of service through large or slow inputs, resource exhaustion, documentation, build scripts.\n\n" +
  "Duplicates: two reports with the same faulty code and the same root cause are duplicates even if worded differently.\n\n" +
  "Severity bars: low = crash or null dereference on crafted input; medium = out-of-bounds read that discloses memory; high = out-of-bounds write or anything giving code execution.";

const stamp = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(stamp(), ...a);
const reader = clientFor();
const rows = [], txs = [];
const rec = (label, r) => txs.push({ label, hash: r.hash, status: r.status, revert: r.revert ?? null });
function verdict(id, name, ok, detail) {
  rows.push({ id, name, ok, detail });
  console.log(`${stamp()} ${ok ? "DELIVERED    " : "NOT DELIVERED"} [${id}] ${name} - ${detail}`);
}

async function deployCode(client, code, args = []) {
  const hash = await paced(() => client.deployContract({ code, args }));
  for (let i = 0; i < 60; i++) {
    await sleep(8000);
    const tx = await paced(() => client.request({ method: "eth_getTransactionByHash", params: [hash] }));
    if (["ACCEPTED", "FINALIZED"].includes(tx?.status)) {
      const addr = tx.data?.contract_address ?? tx.to_address;
      if (!addr) throw new Error("no contract address");
      return { address: addr, hash, status: tx.status };
    }
    if (["UNDETERMINED", "CANCELED", "LEADER_TIMEOUT"].includes(tx?.status)) throw new Error("deploy " + tx.status + " " + JSON.stringify(tx.consensus_data?.leader_receipt?.[0]?.result ?? ""));
  }
  throw new Error("deploy timed out");
}

const chainTime = async () => Number(BigInt((await paced(() => reader.request({ method: "eth_getBlockByNumber", params: ["latest", false] }))).timestamp));
const bal = (a) => balanceOf(reader, a);

async function waitFor(cond, label, ms = 15 * 60 * 1000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await cond();
    if (v) return v;
    await sleep(10000);
  }
  throw new Error("timed out waiting for " + label);
}

const owners = { w1: freshKey(), w2: freshKey(), w3: freshKey(), anyone: freshKey() };
const c = Object.fromEntries(Object.entries(owners).map(([k, v]) => [k, clientFor(v)]));

log("deploying Inquest (retry_gap 60 s, 2 attempts, claims expire after 1 h)");
const inq = await deployCode(c.anyone, readFileSync(join(root, "contracts", "inquest.py"), "utf8"), [60n, 2n, 3600n]);
log("Inquest", inq.address);
const walletCode = readFileSync(join(root, "tests", "support", "proxy_wallet.py"), "utf8");
const w = {};
for (const k of ["w1", "w2", "w3"]) {
  w[k] = await deployCode(c[k], walletCode);
  log(`wallet ${k}`, w[k].address);
}

const forward = async (who, method, args, value = 0n, wait = "ACCEPTED") => {
  const r = await write(c[who], w[who].address, "forward", [inq.address, method, JSON.stringify(args, (_, v) => (typeof v === "bigint" ? Number(v) : v)), value], value, wait);
  rec(`${who}.forward(${method})`, r);
  return r;
};
const inqView = (fn, args) => view(reader, inq.address, fn, args);
const received = async (k) => view(reader, w[k].address, "get_received", []);

const hashHigh = (await fingerprintUrl(FIX + "01-high-heap-overflow.md")).hash;
const hashDup = (await fingerprintUrl(FIX + "03-duplicate-of-high.md")).hash;
const GOOD = FIX + "01-high-heap-overflow.md", DUP = FIX + "03-duplicate-of-high.md";

// ---- project wallet creates bounty 1 (the pool is paid by wallet W1 itself)
let now = await chainTime();
await forward("w1", "create_bounty", ["Wallet bounty", "https://github.com/acme/tinyparse", RUBRIC, LOW, MED, HIGH, now + 3 * 86400, BOND], 3n * HIGH);
const b1 = await waitFor(async () => {
  const l = await inqView("list_bounties", [0n, 20n]);
  return l.items.find((b) => String(b.project).toLowerCase() === w.w1.address.toLowerCase()) ?? null;
}, "bounty created through W1");
log("bounty", b1.id, "project =", b1.project, "pool", String(b1.pool));
verdict("setup", "the project is a smart-contract wallet; the pool left W1", String(b1.project).toLowerCase() === w.w1.address.toLowerCase(), `W1 ${w.w1.address}, pool ${b1.pool}`);

// ---- 1. reward + bond refund -> researcher wallet W2
await forward("w2", "submit_claim", [Number(b1.id), GOOD, hashHigh], BOND);
const cl1 = await waitFor(async () => (await inqView("list_claims", [BigInt(b1.id), w.w2.address, 0n, 5n])).items[0] ?? null, "claim filed by W2");
await forward("w3", "submit_claim", [Number(b1.id), DUP, hashDup], BOND);
const cl2 = await waitFor(async () => (await inqView("list_claims", [BigInt(b1.id), w.w3.address, 0n, 5n])).items[0] ?? null, "claim filed by W3");
const w2Before = await bal(w.w2.address);
const r1 = await write(c.anyone, inq.address, "resolve_claim", [BigInt(cl1.id)], 0n, "FINALIZED");
rec("resolve_claim(original)", r1);
const claim1 = await inqView("get_claim", [BigInt(cl1.id)]);
const w2After = await waitFor(async () => { const b = await bal(w.w2.address); return b !== w2Before ? b : null; }, "W2 balance to change", 12 * 60 * 1000).catch(() => bal(w.w2.address));
const rc2 = await received("w2");
verdict("1", "researcher reward + bond refund reach the researcher wallet", w2After - w2Before === HIGH + BOND, `W2 balance ${w2Before} -> ${w2After} (expected +${HIGH + BOND}); __receive__ calls ${rc2.receipts}, total received ${rc2.received}; claim ${claim1.status} payout ${claim1.payout} bond ${claim1.bond_outcome}; resolve tx ${r1.status}`);

// ---- 2. bond refund only (duplicate)
const w3Before = await bal(w.w3.address);
const r2 = await write(c.anyone, inq.address, "resolve_claim", [BigInt(cl2.id)], 0n, "FINALIZED");
rec("resolve_claim(duplicate)", r2);
const claim2 = await inqView("get_claim", [BigInt(cl2.id)]);
const w3After = await waitFor(async () => { const b = await bal(w.w3.address); return b !== w3Before ? b : null; }, "W3 balance to change", 12 * 60 * 1000).catch(() => bal(w.w3.address));
verdict("2", "bond refund (duplicate, no reward) reaches the researcher wallet", w3After - w3Before === BOND && claim2.duplicate_of !== null, `W3 balance ${w3Before} -> ${w3After} (expected +${BOND}); duplicate_of ${claim2.duplicate_of}, payout ${claim2.payout}; resolve tx ${r2.status}`);

// ---- 3. cancellation -> project wallet
now = await chainTime();
await forward("w1", "create_bounty", ["Wallet cancel", "https://github.com/acme/tinyparse", RUBRIC, LOW, MED, HIGH, now + 3 * 86400, BOND], HIGH);
const b2 = await waitFor(async () => (await inqView("list_bounties", [0n, 5n])).items.find((b) => b.title === "Wallet cancel") ?? null, "second bounty");
const w1Before3 = await bal(w.w1.address);
await forward("w1", "cancel", [Number(b2.id)], 0n, "FINALIZED");
const w1After3 = await waitFor(async () => { const b = await bal(w.w1.address); return b !== w1Before3 ? b : null; }, "W1 balance to change after cancel", 12 * 60 * 1000).catch(() => bal(w.w1.address));
const b2After = await inqView("get_bounty", [BigInt(b2.id)]);
verdict("3", "bounty cancellation returns the pool to the project wallet", w1After3 - w1Before3 === HIGH && b2After.status === "CANCELLED", `W1 balance ${w1Before3} -> ${w1After3} (expected +${HIGH}); bounty ${b2After.status}`);

// ---- 4. withdrawal after the deadline -> project wallet
now = await chainTime();
await forward("w1", "create_bounty", ["Wallet withdraw", "https://github.com/acme/tinyparse", RUBRIC, LOW, MED, HIGH, now + 170, BOND], 2n * HIGH);
const b3 = await waitFor(async () => (await inqView("list_bounties", [0n, 5n])).items.find((b) => b.title === "Wallet withdraw") ?? null, "third bounty");
log("waiting for the 170 s deadline");
await sleep(215000);
const w1Before4 = await bal(w.w1.address);
await forward("w1", "withdraw", [Number(b3.id)], 0n, "FINALIZED");
const w1After4 = await waitFor(async () => { const b = await bal(w.w1.address); return b !== w1Before4 ? b : null; }, "W1 balance to change after withdraw", 12 * 60 * 1000).catch(() => bal(w.w1.address));
verdict("4", "project withdrawal reaches the project wallet", w1After4 - w1Before4 === 2n * HIGH, `W1 balance ${w1Before4} -> ${w1After4} (expected +${2n * HIGH})`);

// ---- ledger + conservation
const failedTotal = await inqView("get_failed_total", []);
verdict("L", "no outgoing transfer failed (failed-payment ledger is empty)", BigInt(failedTotal) === 0n, `get_failed_total ${failedTotal}`);

const delivered = rows.filter((r) => r.ok).length;
let md = `# Recipient-balance delivery to smart-contract wallets (Studionet)\n\n`;
md += `Studionet does not credit externally-owned accounts from contract-emitted transfers, so this run uses contract wallets (\`tests/support/proxy_wallet.py\`) as project and researchers. It proves the four payment paths deliver finalized value to a recipient's own balance on this network. It does **not** prove delivery to an EOA; \`web/e2e/wallet-delivery.mjs\` does that on a testnet.\n\n`;
md += `- Inquest: \`${inq.address}\` (deploy tx \`${inq.hash}\`)\n- W1 (project): \`${w.w1.address}\`\n- W2 (researcher, reward): \`${w.w2.address}\`\n- W3 (researcher, duplicate): \`${w.w3.address}\`\n`;
md += `- Result: **${delivered}/${rows.length} checks delivered**\n\n| Path | Check | Result | Balances |\n| --- | --- | --- | --- |\n`;
for (const r of rows) md += `| ${r.id} | ${r.name} | ${r.ok ? "DELIVERED" : "NOT DELIVERED"} | ${r.detail.replace(/\|/g, "\\|")} |\n`;
md += `\n## Transactions\n\n| Step | Status | Revert | Hash |\n| --- | --- | --- | --- |\n`;
for (const t of txs) md += `| ${t.label} | ${t.status} | ${t.revert ?? ""} | \`${t.hash}\` |\n`;
writeFileSync(join(root, "docs", "WALLET-DELIVERY-studionet-contract-wallets.md"), md);
console.log(`\n${delivered}/${rows.length} delivered. Report: docs/WALLET-DELIVERY-studionet-contract-wallets.md`);
process.exit(delivered === rows.length ? 0 : 1);
