/**
 * The one GenLayer client file. Nothing in this app decides a verdict, a payout or an appeal outcome:
 * the page sends what the contract asks for and shows what it answers. Reads are batched (the list
 * views return whole pages) because the hosted RPC allows roughly 30 requests a minute per client.
 */
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { Bounty, Claim, Page, Phase, TxOutcome } from "./types.ts";
import { TIME_DEPENDENT, REFUSALS, decodeRevert, plain, refusalKey, toBounty, toClaim, type Raw } from "./decode.ts";
import { assertSignerReady, getProvider, type Signer } from "./signer.ts";

export { describeError } from "./decode.ts";

type Hex = `0x${string}`;

export const CONTRACT = (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined)?.trim() ?? "";
export const hasContract = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT) && !/^0x0+$/.test(CONTRACT);
export const NETWORK = studionet.name;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * genlayer-js 1.1.8 is what the live Studionet accepts (measured: the 2.0.0-rc client cannot read or deploy
 * against it). The 2.x-only calls below are feature-detected, so this file upgrades itself when they exist.
 */
interface Loose {
  readContract: (a: unknown) => Promise<unknown>;
  writeContract: (a: unknown) => Promise<unknown>;
  simulateWriteContract?: (a: unknown) => Promise<unknown>;
  request: (a: { method: string; params: unknown[] }) => Promise<unknown>;
  canAppeal: (a: { txId: Hex }) => Promise<boolean>;
  appealTransaction: (a: unknown) => Promise<unknown>;
  getAppealCharge?: (a: { txId: Hex }) => Promise<bigint>;
  getMinAppealBond: (a: { txId: Hex }) => Promise<bigint>;
  estimateTransactionFeesForWrite?: (a: unknown) => Promise<{ distribution: unknown; messageAllocations?: unknown; feeValue: bigint }>;
}

function readClient(): Loose {
  return createClient({ chain: studionet }) as unknown as Loose;
}

function writeClient(signer: Signer): Loose {
  if (signer.kind === "sandbox") {
    return createClient({ chain: studionet, account: createAccount(signer.key) }) as unknown as Loose;
  }
  const provider = getProvider();
  if (!provider) throw new Error("No browser wallet found. Install an EIP-1193 wallet such as MetaMask, or use the demo account.");
  return createClient({ chain: studionet, account: signer.address as Hex, provider: provider as never }) as unknown as Loose;
}

// ------------------------------------------------------------------ pacing
function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)) ?? "";
  } catch {
    return "";
  }
}

/** Retries rate limits and network blips; anything else is a real error and is rethrown. */
async function paced<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const text = `${e instanceof Error ? e.message : String(e)} ${safeJson((e as { cause?: unknown })?.cause)}`;
      const m = text.match(/retry_after_seconds\D+(\d+)/);
      if (text.includes("-32029") || m) {
        await sleep(((m ? Number(m[1]) : 20) + 2) * 1000);
        continue;
      }
      if (/fetch failed|Failed to fetch|NetworkError|ECONNRESET|ETIMEDOUT|<html|<!DOCTYPE|Unexpected token '<'|unknown RPC error|502|503|504/i.test(text)) {
        await sleep((6 + attempt * 5) * 1000);
        continue;
      }
      throw e;
    }
  }
  throw new Error("The network kept failing. Try again in a minute.");
}

// ------------------------------------------------------------------ reads
async function view(functionName: string, args: unknown[]): Promise<unknown> {
  if (!hasContract) throw new Error("No contract address is configured. Set VITE_CONTRACT_ADDRESS.");
  const raw = await paced(() => readClient().readContract({ address: CONTRACT as Hex, functionName, args }));
  return plain(raw);
}

export async function listBounties(offset = 0, limit = 20): Promise<Page<Bounty>> {
  const r = (await view("list_bounties", [BigInt(offset), BigInt(limit)])) as Raw;
  return { total: Number(r.total), items: (r.items as Raw[]).map(toBounty) };
}

export async function getBounty(id: number): Promise<Bounty> {
  return toBounty((await view("get_bounty", [BigInt(id)])) as Raw);
}

export async function getClaim(id: number): Promise<Claim> {
  return toClaim((await view("get_claim", [BigInt(id)])) as Raw);
}

/** bountyId 0 = every bounty. researcher "" = anyone. */
export async function listClaims(bountyId: number, researcher = "", offset = 0, limit = 20): Promise<Page<Claim>> {
  const r = (await view("list_claims", [BigInt(bountyId), researcher, BigInt(offset), BigInt(limit)])) as Raw;
  return { total: Number(r.total), items: (r.items as Raw[]).map(toClaim) };
}

export async function chainNow(): Promise<number> {
  const block = (await paced(() =>
    readClient().request({ method: "eth_getBlockByNumber", params: ["latest", false] }),
  )) as { timestamp?: string } | null;
  return block?.timestamp ? Number(BigInt(block.timestamp)) : Math.floor(Date.now() / 1000);
}

/** GEN the contract itself holds: pools + slashed bonds + live bonds. (Studionet does not credit ordinary accounts.) */
export async function contractBalance(): Promise<bigint> {
  if (!hasContract) return 0n;
  const hex = (await paced(() => readClient().request({ method: "eth_getBalance", params: [CONTRACT, "latest"] }))) as string;
  return BigInt(hex);
}

// ------------------------------------------------------------------ writes
interface RawTx {
  status?: string;
  consensus_data?: { leader_receipt?: Array<{ mode?: string; execution_result?: string; result?: unknown }> };
}

const DEAD_TEXT: Record<string, string> = {
  UNDETERMINED:
    "The validators could not agree, so nothing was recorded and no GEN moved. The claim is still waiting; you can resolve it again.",
  CANCELED: "The transaction was cancelled before it ran. Nothing changed.",
  LEADER_TIMEOUT: "The lead validator timed out. Nothing changed. Try again.",
  VALIDATORS_TIMEOUT: "The validators timed out. Nothing changed. Try again.",
};
const DEAD = new Set(Object.keys(DEAD_TEXT));

function leaderRevert(tx: RawTx): string | undefined {
  const receipts = tx.consensus_data?.leader_receipt;
  const leader = receipts?.find((r) => r.mode === "leader") ?? receipts?.[0];
  if (!leader || leader.execution_result !== "ERROR") return undefined;
  const res = leader.result;
  const payload = typeof res === "string" ? res : (res as { payload?: string } | undefined)?.payload;
  const text = decodeRevert(payload);
  return text ? (REFUSALS[text] ?? text) : "The contract refused the call.";
}

export async function readTx(hash: string): Promise<RawTx | null> {
  return (await paced(() =>
    readClient().request({ method: "eth_getTransactionByHash", params: [hash] }),
  )) as RawTx | null;
}

/** Follow a transaction to finalization. 8 s polling keeps one client well under the RPC limit. */
async function follow(hash: string, onPhase?: (p: Phase, detail?: string) => void): Promise<TxOutcome> {
  const started = Date.now();
  let accepted = false;
  while (Date.now() - started < 20 * 60 * 1000) {
    await sleep(8000);
    const tx = await readTx(hash);
    const status = tx?.status ?? "PENDING";
    onPhase?.(accepted ? "accepted" : "pending", status);
    if (DEAD.has(status)) return { hash, status, error: DEAD_TEXT[status] };
    if (status === "ACCEPTED" || status === "FINALIZED") {
      const error = tx ? leaderRevert(tx) : undefined;
      if (error) return { hash, status, error };
      if (status === "FINALIZED") {
        onPhase?.("finalized", status);
        return { hash, status };
      }
      accepted = true;
      onPhase?.("accepted", status);
    }
  }
  return {
    hash,
    status: "TIMEOUT",
    error: "Still not finalized after 20 minutes. Nothing is lost: GEN moves only on finalization. Check back later.",
  };
}

/**
 * A refused payable call keeps its attached GEN inside the contract on this runtime (measured), so before any value
 * leaves the account the call is dry-run. Clock-dependent refusals never block: a dry run may see a stale time.
 */
async function preflight(client: Loose, functionName: string, args: unknown[], value: bigint): Promise<void> {
  if (value === 0n || !client.simulateWriteContract) return;
  try {
    await paced(() => client.simulateWriteContract!({ address: CONTRACT as Hex, functionName, args, value }));
  } catch (e) {
    const refusal = refusalKey(e);
    if (refusal && !TIME_DEPENDENT.has(refusal)) throw new Error(REFUSALS[refusal] ?? refusal);
  }
}

/** Send a write (dry-run first when it carries GEN), then follow it to finalization. */
export async function sendTx(
  signer: Signer,
  functionName: string,
  args: unknown[],
  value = 0n,
  onPhase?: (p: Phase, detail?: string) => void,
  onHash?: (hash: string) => void,
): Promise<TxOutcome> {
  if (!hasContract) throw new Error("No contract address is configured. Set VITE_CONTRACT_ADDRESS.");
  await assertSignerReady(signer);
  const client = writeClient(signer);
  onPhase?.("signing");
  await preflight(client, functionName, args, value);

  let fees: unknown;
  if (client.estimateTransactionFeesForWrite) {
    try {
      const est = await paced(() =>
        client.estimateTransactionFeesForWrite!({ account: signer.address, address: CONTRACT, functionName, args, value }),
      );
      fees = { distribution: est.distribution, messageAllocations: est.messageAllocations, feeValue: est.feeValue };
    } catch {
      fees = undefined; // estimation unavailable: let the SDK use its defaults
    }
  }
  const hash = (await paced(() =>
    client.writeContract({ address: CONTRACT, functionName, args, value, ...(fees ? { fees } : {}) }),
  )) as string;
  onHash?.(hash);
  onPhase?.("pending");
  return follow(hash, onPhase);
}

// ------------------------------------------------------------------ protocol appeal
export interface AppealInfo {
  appealable: boolean;
  charge: bigint | null;
}

/** Asks the protocol, not this app, whether the round is still appealable and what it costs. */
export async function appealInfo(txHash: string): Promise<AppealInfo> {
  const client = readClient();
  const appealable = await paced(() => client.canAppeal({ txId: txHash as Hex }));
  if (!appealable) return { appealable: false, charge: null };
  const charge = await paced(() =>
    client.getAppealCharge ? client.getAppealCharge({ txId: txHash as Hex }) : client.getMinAppealBond({ txId: txHash as Hex }),
  );
  return { appealable: true, charge };
}

export async function appeal(signer: Signer, txHash: string, charge: bigint): Promise<string> {
  await assertSignerReady(signer);
  const client = writeClient(signer);
  const out = await paced(() => client.appealTransaction({ txId: txHash as Hex, value: charge }));
  return String(out);
}

// ------------------------------------------------------------------ resolve tx memory (this browser only)
const memKey = (claimId: number) => `inquest:${CONTRACT.toLowerCase()}:resolve:${claimId}`;

export function rememberResolveTx(claimId: number, hash: string): void {
  try {
    localStorage.setItem(memKey(claimId), hash);
  } catch {
    /* private mode: the appeal button just won't know the hash */
  }
}

export function recallResolveTx(claimId: number): string | null {
  try {
    return localStorage.getItem(memKey(claimId));
  } catch {
    return null;
  }
}
