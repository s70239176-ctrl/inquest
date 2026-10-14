// Seed a freshly deployed Inquest contract with one real, finalized example so the hosted app has something to show:
// a bounty, a high-severity report (fetched and fingerprinted like a researcher would) and the jury's verdict.
//
//   cd web && node --experimental-strip-types scripts/seed.mjs <contract-address>
//
// Uses throwaway keys and Studionet's gasless transactions. Prints every transaction hash.
import { addressOf, balanceOf, clientFor, freshKey, returnOf, sleep, view, write } from "./chain-lib.mjs";
import { fingerprintUrl } from "../src/lib/fingerprint.ts";

const address = process.argv[2] ?? process.env.VITE_CONTRACT_ADDRESS;
if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? "")) throw new Error("usage: node scripts/seed.mjs <contract-address>");
const FIX = process.env.FIXTURE_BASE ?? "https://raw.githubusercontent.com/s70239176-ctrl/inquest/main/fixtures/tinyparse/";
const GEN = 10n ** 18n;

const RUBRIC =
  "In scope: memory-safety bugs in the tinyparse C library's header and body parsers (heap or stack overflow, out-of-bounds read or write, use after free).\n\n" +
  "Out of scope: denial of service through large or slow inputs, resource exhaustion, documentation, build scripts, and anything requiring local write access.\n\n" +
  "Duplicates: two reports with the same faulty code and the same root cause are duplicates even if worded differently. Same symptom with a different cause is not a duplicate.\n\n" +
  "Severity bars: low = crash or null dereference on crafted input; medium = out-of-bounds read that discloses memory; high = out-of-bounds write or anything giving code execution.";

const project = clientFor(freshKey());
const researcher = clientFor(freshKey());
const reader = clientFor();
const block = await reader.request({ method: "eth_getBlockByNumber", params: ["latest", false] });
const now = Number(BigInt(block.timestamp));

const created = await write(project, address, "create_bounty",
  ["tinyparse memory-safety bounty", "https://github.com/acme/tinyparse", RUBRIC, GEN, 3n * GEN, 10n * GEN, BigInt(now + 60 * 86400), GEN / 100n], 14n * GEN);
console.log("create_bounty", created.status, created.hash, JSON.stringify(returnOf(created.tx)));
const bountyId = BigInt(returnOf(created.tx).id);

const url = FIX + "01-high-heap-overflow.md";
const fp = await fingerprintUrl(url);
const filed = await write(researcher, address, "submit_claim", [bountyId, url, fp.hash], GEN / 100n);
console.log("submit_claim", filed.status, filed.hash, JSON.stringify(returnOf(filed.tx)));
const claimId = BigInt(returnOf(filed.tx).id);

const resolved = await write(project, address, "resolve_claim", [claimId], 0n, "FINALIZED");
console.log("resolve_claim", resolved.status, resolved.hash, JSON.stringify(returnOf(resolved.tx)));
const claim = await view(reader, address, "get_claim", [claimId]);
console.log("verdict:", JSON.stringify(claim, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
console.log(`SEED bounty=${bountyId} claim=${claimId} resolve_tx=${resolved.hash}`);
