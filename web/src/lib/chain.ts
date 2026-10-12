/**
 * The one GenLayer client file. Nothing in this app decides a verdict, a payout or an appeal outcome:
 * the page sends what the contract asks for and shows what it answers. Reads are batched (the list
 * views return whole pages) because the hosted RPC allows roughly 30 requests a minute per client.
 */
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { Bounty, BondOutcome, Claim, ClaimStatus, BountyStatus, Page, Phase, Severity, TxOutcome } from "./types.ts";
import { assertSameAccount, getProvider } from "./wallet.ts";

type Hex = `0x${string}`;

export const CONTRACT = (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined)?.trim() ?? "";
export const hasContract = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT) && !/^0x0+$/.test(CONTRACT);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * genlayer-js 1.1.8 is what the live Studionet accepts (measured: the 2.0.0-rc client cannot read or deploy
 * against it). The 2.x-only calls below are feature-detected, so this file upgrades itself when they exist.
 */
interface Loose {
  readContract: (a: unknown) => Promise<unknown>;
  writeContract: (a: unknown) => Promise<unknown>;
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

function writeClient(account: string): Loose {
  const provider = getProvider();
  if (!provider) throw new Error("No browser wallet found. Install an EIP-1193 wallet such as MetaMask.");
  return createClient({ chain: studionet, account: account as Hex, provider: provider as never }) as unknown as Loose;
}

// ------------------------------------------------------------------ pacing + errors
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

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** The contract's own refusal text, base64 (tag byte + utf-8) in a dry-run error or a leader receipt. */
function decodeRevert(payload: unknown): string | undefined {
  if (typeof payload !== "string" || payload === "") return undefined;
  try {
    const bytes = fromB64(payload);
    const text = new TextDecoder().decode(bytes.subarray(bytes[0] !== undefined && bytes[0] <= 8 ? 1 : 0));
    return /^[\x20-\x7e]{1,80}$/.test(text) ? text : undefined;
  } catch {
    return undefined;
  }
}

const REFUSALS: Record<string, string> = {
  "empty pool": "Attach some GEN: the pool cannot be empty.",
  "bad title": "The title must be 1 to 120 characters.",
  "bad rubric": "The rubric must be non-empty and at most 6,000 characters.",
  "bad url": "That is not an acceptable public https URL (no credentials, ports, IP addresses or local hosts).",
  "bad payouts": "Payouts must satisfy high ≥ medium ≥ low > 0.",
  "bad deadline": "The deadline must be in the future and at most 90 days out.",
  "bad bond": "The bond must be between 1% and 50% of the low payout.",
  "pool below high payout": "The pool must cover at least one high payout.",
  "too late": "The deadline has passed.",
  "bond mismatch": "Attach exactly the bounty's bond.",
  "pending exists": "You already have a claim waiting for a verdict on this bounty.",
  "attempt limit": "You have used all 3 claims allowed on this bounty.",
  "claim limit": "This bounty already has the maximum 40 claims.",
  "not project": "Only the project that created the bounty can do that.",
  "nothing to withdraw": "Nothing is withdrawable yet. The deadline must pass (or the bounty end) and no claim may be waiting.",
  "already resolved": "This claim already has a verdict.",
  "not open": "This bounty is no longer open.",
  "has claims": "A bounty with claims cannot be cancelled.",
  "project cannot claim": "The project cannot claim its own bounty.",
  "bad judgment": "The jury returned something unusable. Nothing moved. Try resolving again.",
};

export function describeError(e: unknown): string {
  const cause = (e as { cause?: { data?: { receipt?: { result?: unknown } } } })?.cause;
  const decoded = decodeRevert(cause?.data?.receipt?.result);
  if (decoded) return REFUSALS[decoded] ?? decoded;
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied|4001/i.test(msg)) return "You declined the request in your wallet.";
  return msg.length > 300 ? msg.slice(0, 300) + "…" : msg;
}

// ------------------------------------------------------------------ decoding views
/** genlayer-js may hand back Maps for contract dicts; normalise to plain objects (bigints kept). */
function plain(v: unknown): unknown {
  if (v instanceof Map) return Object.fromEntries([...v.entries()].map(([k, x]) => [String(k), plain(x)]));
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object" && !(v instanceof Uint8Array)) {
    return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

const big = (v: unknown): bigint => BigInt(v as never);
const n = (v: unknown): number => Number(v);
const nullable = <T,>(v: unknown, f: (x: unknown) => T): T | null => (v === null || v === undefined ? null : f(v));
const hex = (v: unknown): string => String(v).toLowerCase();

type Raw = Record<string, unknown>;

export function toBounty(r: Raw): Bounty {
  return {
    id: n(r.id),
    project: hex(r.project),
    title: String(r.title),
    repoUrl: String(r.repo_url),
    rubric: String(r.rubric),
    lowPayout: big(r.low_payout),
    mediumPayout: big(r.medium_payout),
    highPayout: big(r.high_payout),
    bond: big(r.bond),
    deadline: n(r.deadline),
    createdAt: n(r.created_at),
    status: String(r.status) as BountyStatus,
    pool: big(r.pool),
    slashed: big(r.slashed),
    claimIds: (r.claim_ids as unknown[]).map(n),
    acceptedIds: (r.accepted_ids as unknown[]).map(n),
    claimCount: n(r.claim_count),
    pendingCount: n(r.pending_count),
    withdrawable: big(r.withdrawable),
  };
}

export function toClaim(r: Raw): Claim {
  return {
    id: n(r.id),
    bountyId: n(r.bounty_id),
    researcher: hex(r.researcher),
    url: String(r.url),
    bond: big(r.bond),
    status: String(r.status) as ClaimStatus,
    evidenceAvailable: nullable(r.evidence_available, Boolean),
    demonstrated: nullable(r.demonstrated, Boolean),
    inScope: nullable(r.in_scope, Boolean),
    duplicateOf: nullable(r.duplicate_of, n),
    severity: nullable(r.severity, (x) => String(x) as Severity),
    payout: big(r.payout),
    bondOutcome: String(r.bond_outcome) as BondOutcome,
    createdAt: n(r.created_at),
    resolvedAt: n(r.resolved_at),
  };
}

async function view(functionName: string, args: unknown[]): Promise<unknown> {
  if (!hasContract) throw new Error("No contract address is configured. Set VITE_CONTRACT_ADDRESS.");
  const raw = await paced(() =>
    readClient().readContract({ address: CONTRACT as Hex, functionName, args }),
  );
  return plain(raw);
}

export async function listBounties(offset = 0, limit = 20): Promise<Page<Bounty>> {
  const r = (await view("list_bounties", [BigInt(offset), BigInt(limit)])) as Raw;
  return { total: n(r.total), items: (r.items as Raw[]).map(toBounty) };
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
  return { total: n(r.total), items: (r.items as Raw[]).map(toClaim) };
}

export async function getLedger(bountyId: number): Promise<bigint> {
  return big(await view("get_ledger", [BigInt(bountyId)]));
}

export async function chainNow(): Promise<number> {
  const block = (await paced(() =>
    readClient().request({ method: "eth_getBlockByNumber", params: ["latest", false] }),
  )) as { timestamp?: string } | null;
  return block?.timestamp ? Number(BigInt(block.timestamp)) : Math.floor(Date.now() / 1000);
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

/** Estimate fees, send `value` separately from the fees, then wait for finalization. */
export async function sendTx(
  account: string,
  functionName: string,
  args: unknown[],
  value = 0n,
  onPhase?: (p: Phase, detail?: string) => void,
  onHash?: (hash: string) => void,
): Promise<TxOutcome> {
  if (!hasContract) throw new Error("No contract address is configured. Set VITE_CONTRACT_ADDRESS.");
  await assertSameAccount(`wallet:${account}`);
  const client = writeClient(account);
  onPhase?.("signing");
  let fees: unknown;
  if (client.estimateTransactionFeesForWrite) {
    try {
      const est = await paced(() =>
        client.estimateTransactionFeesForWrite!({ account, address: CONTRACT, functionName, args, value }),
      );
      fees = { distribution: est.distribution, messageAllocations: est.messageAllocations, feeValue: est.feeValue };
    } catch (e) {
      const decoded = describeError(e);
      if (Object.values(REFUSALS).includes(decoded)) throw new Error(decoded);
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

export async function appeal(account: string, txHash: string, charge: bigint): Promise<string> {
  await assertSameAccount(`wallet:${account}`);
  const client = writeClient(account);
  const out = await paced(() => client.appealTransaction({ txId: txHash as Hex, value: charge }));
  return String(out);
}

// ------------------------------------------------------------------ resolve tx memory (this browser only)
const key = (claimId: number) => `inquest:${CONTRACT.toLowerCase()}:resolve:${claimId}`;

export function rememberResolveTx(claimId: number, hash: string): void {
  try {
    localStorage.setItem(key(claimId), hash);
  } catch {
    /* private mode: the appeal button just won't know the hash */
  }
}

export function recallResolveTx(claimId: number): string | null {
  try {
    return localStorage.getItem(key(claimId));
  } catch {
    return null;
  }
}
