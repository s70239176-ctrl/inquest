import { clientFor } from "./chain-lib.mjs";
const [addr, fn, ...args] = process.argv.slice(2);
const c = clientFor();
try {
  const r = await c.readContract({ address: addr, functionName: fn, args: args.map((a) => (/^\d+$/.test(a) ? BigInt(a) : a)) });
  console.log("OK", JSON.stringify(r, (_, v) => (typeof v === "bigint" ? v.toString() : v instanceof Map ? Object.fromEntries(v) : v)));
} catch (e) {
  console.log("ERR", e.shortMessage ?? e.message);
  console.log("cause", JSON.stringify(e.cause, (_, v) => (typeof v === "bigint" ? v.toString() : v))?.slice(0, 1500));
}
