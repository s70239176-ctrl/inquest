import { clientFor, paced } from "./chain-lib.mjs";
const tx = await paced(() => clientFor().request({ method: "eth_getTransactionByHash", params: [process.argv[2]] }));
const slim = JSON.parse(JSON.stringify(tx, (k, v) => (typeof v === "bigint" ? v.toString() : typeof v === "string" && v.length > 300 ? v.slice(0, 300) + "…" : v)));
console.log(JSON.stringify(slim, null, 1).slice(0, 4000));
