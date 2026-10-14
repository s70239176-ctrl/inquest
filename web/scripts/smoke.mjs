// Live Studionet smoke test: create -> submit -> resolve (real validators, real fetch) -> read back.
// Usage (from web/):  node scripts/smoke.mjs <contract-address>
// Uses throwaway keys and tiny wei amounts. Writeups are deliberately NOT real bug reports.
import { clientFor, freshKey, paced, view, write } from "./chain-lib.mjs";
import { contentHash, fingerprintUrl } from "../src/lib/fingerprint.ts";

const address = process.argv[2] ?? process.env.VITE_CONTRACT_ADDRESS;
if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? "")) throw new Error("usage: node scripts/smoke.mjs <contract-address>");

const project = clientFor(freshKey());
const alice = clientFor(freshKey());
const bob = clientFor(freshKey());
const carol = clientFor(freshKey());

const rubric =
  "In scope: memory disclosure bugs in the OpenSSL TLS heartbeat extension.\n\nOut of scope: every other component; denial of service.\n\n" +
  "Duplicates: same root cause as an accepted report.\n\nSeverity bars: low = crash or tiny leak; medium = leaks bounded process memory; high = remotely leaks private keys or session secrets.";

const block = await paced(() => project.request({ method: "eth_getBlockByNumber", params: ["latest", false] }));
const now = Number(BigInt(block.timestamp));

function show(label, r) {
  const leader = r.tx?.consensus_data?.leader_receipt?.[0];
  console.log(label, r.status, leader?.execution_result ?? "");
  if (leader?.execution_result === "ERROR") console.log("  revert payload:", JSON.stringify(leader.result));
}

const created = await write(project, address, "create_bounty",
  ["Heartbeat bounty", "https://github.com/acme/parser", rubric, 1000n, 3000n, 10000n, BigInt(now + 7 * 86400), 100n], 20000n);
show("create_bounty", created);
const bounty = await view(project, address, "get_bounty", [1n]).catch(() => null);
const list = await view(project, address, "list_bounties", [0n, 20n]);
const bountyId = BigInt(list.items[0].id);
console.log("bounty", bountyId.toString(), "pool", list.items[0].pool.toString(), "status", list.items[0].status, bounty ? "" : "(get_bounty(1) missing: not the first bounty on this contract)");

const sub1 = await write(alice, address, "submit_claim", [bountyId, "https://example.com/", (await fingerprintUrl("https://example.com/")).hash], 100n);
show("submit_claim(example.com)", sub1);
const sub2 = await write(bob, address, "submit_claim", [bountyId, "https://this-host-does-not-exist.invalid-inquest.example/report", await contentHash("unreachable")], 100n);
show("submit_claim(dead url)", sub2);

const sub3 = await write(carol, address, "submit_claim", [bountyId, "https://blog.cloudflare.com/answering-the-critical-question-can-you-get-private-ssl-keys-using-heartbleed/", (await fingerprintUrl("https://blog.cloudflare.com/answering-the-critical-question-can-you-get-private-ssl-keys-using-heartbleed/")).hash], 100n);
show("submit_claim(heartbleed writeup)", sub3);

const claims = await view(project, address, "list_claims", [bountyId, "", 0n, 20n]);
console.log("claims:", claims.items.map((c) => `#${c.id}:${c.status}`).join(" "));

for (const c of [...claims.items].reverse()) {
  const r = await write(project, address, "resolve_claim", [BigInt(c.id)], 0n);
  show(`resolve_claim #${c.id}`, r);
  const after = await view(project, address, "get_claim", [BigInt(c.id)]);
  console.log(`  -> ${after.status} evidence=${after.evidence_available} demonstrated=${after.demonstrated} in_scope=${after.in_scope} dup=${after.duplicate_of} severity=${after.severity} payout=${after.payout} bond=${after.bond_outcome}`);
}
const end = await view(project, address, "get_bounty", [bountyId]);
console.log("bounty after:", `pool=${end.pool} slashed=${end.slashed} pending=${end.pending_count} status=${end.status}`);
