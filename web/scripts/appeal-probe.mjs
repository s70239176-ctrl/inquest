// Live probe: soft refusal refunds, and can an appeal be filed on Studionet?  node scripts/appeal-probe.mjs
import { readFileSync } from "node:fs";
import { addressOf, balanceOf, clientFor, freshKey, paced, returnOf, sleep, view, write } from "./chain-lib.mjs";

const code = readFileSync("../contracts/inquest.py", "utf8");
const d = clientFor(freshKey());
const dh = await paced(() => d.deployContract({ code, args: [] }));
let A;
for (let i = 0; i < 60 && !A; i++) { await sleep(8000); const t = await paced(() => d.request({ method: "eth_getTransactionByHash", params: [dh] })); if (["ACCEPTED","FINALIZED"].includes(t?.status)) A = t.data?.contract_address ?? t.to_address; }
console.log("contract", A);
const reader = clientFor();
const proj = clientFor(freshKey()), res = clientFor(freshKey());
const now = Number(BigInt((await paced(() => reader.request({ method: "eth_getBlockByNumber", params: ["latest", false] }))).timestamp));
const rubric = "In scope: x.\n\nOut of scope: y.\n\nDuplicates: z.\n\nSeverity bars: low = a; medium = b; high = c.";

// 1. soft refusal on create (pool below high payout): should return ok:false and refund on finalization
const b0 = await balanceOf(reader, A);
const r1 = await write(proj, A, "create_bounty", ["t", "https://github.com/a/b", rubric, 1000n, 3000n, 10000n, BigInt(now + 86400), 100n], 5000n, "FINALIZED");
console.log("create(refused)", r1.status, JSON.stringify(returnOf(r1.tx)), "revert:", r1.revert);
let b1 = await balanceOf(reader, A);
for (let i = 0; i < 20 && b1 !== b0; i++) { await sleep(8000); b1 = await balanceOf(reader, A); }
console.log("balance before", b0, "after refusal finalized", b1, b1 === b0 ? "=> REFUNDED" : "=> NOT REFUNDED");

// 2. real bounty + claim + resolve at ACCEPTED, then try to appeal
const r2 = await write(proj, A, "create_bounty", ["t", "https://github.com/a/b", rubric, 1000n, 3000n, 10000n, BigInt(now + 86400), 100n], 10000n);
console.log("create", r2.status, JSON.stringify(returnOf(r2.tx)));
const r3 = await write(res, A, "submit_claim", [1n, "https://this-host-does-not-exist.inquest-e2e.example/x"], 100n);
console.log("submit", r3.status, JSON.stringify(returnOf(r3.tx)));
const r4 = await write(res, A, "resolve_claim", [1n], 0n, "ACCEPTED");
console.log("resolve", r4.status, JSON.stringify(returnOf(r4.tx)));
const ac = clientFor(freshKey());
for (const [name, fn] of [["canAppeal", () => ac.canAppeal({ txId: r4.hash })], ["getMinAppealBond", () => ac.getMinAppealBond({ txId: r4.hash })], ["appealTransaction", () => ac.appealTransaction({ txId: r4.hash })]]) {
  try { console.log(name, "=>", String(await paced(fn)).slice(0, 120)); } catch (e) { console.log(name, "ERR", (e.shortMessage ?? e.message).slice(0, 200)); }
}
for (let i = 0; i < 40; i++) {
  await sleep(8000);
  const t = await paced(() => reader.request({ method: "eth_getTransactionByHash", params: [r4.hash] }));
  console.log("  resolve tx status", t?.status, "appealed", t?.appealed, "rounds", t?.num_of_rounds);
  if (t?.status === "FINALIZED") break;
}
console.log("claim", JSON.stringify(await view(reader, A, "get_claim", [1n])));
