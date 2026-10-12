// Shared helpers for the deploy and smoke scripts. Run from the web/ directory (genlayer-js lives there).
import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function clientFor(key) {
  return createClient({ chain: studionet, account: key ? createAccount(key) : undefined });
}
export const freshKey = () => generatePrivateKey();

/** Studionet allows ~30 requests a minute per client: retry rate limits and gateway blips. */
export async function paced(fn) {
  for (let i = 0; i < 12; i++) {
    try {
      return await fn();
    } catch (e) {
      const text = `${e?.message ?? e} ${JSON.stringify(e?.cause ?? "", (_, v) => (typeof v === "bigint" ? v.toString() : v))}`;
      const m = text.match(/retry_after_seconds\D+(\d+)/);
      if (text.includes("-32029") || m) { await sleep(((m ? Number(m[1]) : 20) + 2) * 1000); continue; }
      if (/fetch failed|Failed to fetch|ECONNRESET|ETIMEDOUT|<html|<!DOCTYPE|Unexpected token '<'|unknown RPC error|502|503|504/i.test(text)) { await sleep((6 + i * 5) * 1000); continue; }
      throw e;
    }
  }
  throw new Error("network kept failing");
}

export const plain = (v) =>
  v instanceof Map ? Object.fromEntries([...v].map(([k, x]) => [String(k), plain(x)]))
  : Array.isArray(v) ? v.map(plain)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]))
  : v;

export async function view(client, address, functionName, args = []) {
  return plain(await paced(() => client.readContract({ address, functionName, args })));
}

const TERMINAL = new Set(["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT"]);

/** Send a write and poll one cheap RPC until the network settles it. Returns { hash, status, tx }. */
export async function write(client, address, functionName, args, value = 0n, waitFor = "ACCEPTED") {
  const hash = await paced(() => client.writeContract({ address, functionName, args, value }));
  const started = Date.now();
  while (Date.now() - started < 15 * 60 * 1000) {
    await sleep(8000);
    const tx = await paced(() => client.request({ method: "eth_getTransactionByHash", params: [hash] }));
    const status = tx?.status ?? "PENDING";
    if (TERMINAL.has(status) && (waitFor === "ACCEPTED" || status === "FINALIZED" || !["ACCEPTED"].includes(status))) {
      return { hash, status, tx };
    }
  }
  return { hash, status: "TIMEOUT", tx: null };
}
