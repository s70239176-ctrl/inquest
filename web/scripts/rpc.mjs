// Raw JSON-RPC probe:  node scripts/rpc.mjs <method> '<json params array>'
import { clientFor } from "./chain-lib.mjs";
const [method, params = "[]"] = process.argv.slice(2);
try {
  const r = await clientFor().request({ method, params: JSON.parse(params) });
  console.log("OK", JSON.stringify(r, (_, v) => (typeof v === "bigint" ? v.toString() : v))?.slice(0, 600));
} catch (e) {
  console.log("ERR", e.shortMessage ?? e.message, "|", JSON.stringify(e.cause ?? "")?.slice(0, 300));
}
