import { clientFor, freshKey } from "./chain-lib.mjs";
const c = clientFor(freshKey());
try { await c.appealTransaction({ txId: process.argv[2] }); console.log("appealed"); }
catch (e) { console.log("ERR", e.shortMessage ?? e.message); console.log(JSON.stringify(e.cause ?? e.details ?? "", (_, v) => (typeof v === "bigint" ? v.toString() : v))?.slice(0, 800)); console.log((e.stack ?? "").split("\n").slice(0, 8).join("\n")); }
