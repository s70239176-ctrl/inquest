import { clientFor, freshKey, write } from "./chain-lib.mjs";
const [addr, id] = process.argv.slice(2);
const c = clientFor(freshKey());
const r = await write(c, addr, "resolve_claim", [BigInt(id)], 0n);
console.log("status", r.status, r.hash);
const lr = r.tx?.consensus_data?.leader_receipt ?? [];
for (const x of lr) {
  console.log("mode", x.mode, "exec", x.execution_result);
  console.log(" result", JSON.stringify(x.result)?.slice(0, 600));
  console.log(" eq_outputs", JSON.stringify(x.eq_outputs)?.slice(0, 1200));
  console.log(" stderr", String(x.genvm_result?.stderr ?? "").slice(0, 1500));
  console.log(" stdout", String(x.genvm_result?.stdout ?? "").slice(0, 600));
}
