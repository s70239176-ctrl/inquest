/**
 * Pure decoding: contract view dictionaries -> typed objects, and contract refusals -> plain language.
 * No network, no environment: unit-tested in node.
 */
import type { BondOutcome, Bounty, BountyStatus, Claim, ClaimStatus, EvidenceState, Params, Severity } from "./types.ts";

/** genlayer-js may hand back Maps for contract dicts; normalise to plain objects (bigints kept). */
export function plain(v: unknown): unknown {
  if (v instanceof Map) return Object.fromEntries([...v.entries()].map(([k, x]) => [String(k), plain(x)]));
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === "object" && !(v instanceof Uint8Array)) {
    return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, plain(x)]));
  }
  return v;
}

const big = (v: unknown): bigint => BigInt(v as never);
const num = (v: unknown): number => Number(v);
const nullable = <T,>(v: unknown, f: (x: unknown) => T): T | null => (v === null || v === undefined ? null : f(v));
const addr = (v: unknown): string => String(v).toLowerCase();

export type Raw = Record<string, unknown>;

export function toBounty(r: Raw): Bounty {
  return {
    id: num(r.id),
    project: addr(r.project),
    title: String(r.title),
    repoUrl: String(r.repo_url),
    rubric: String(r.rubric),
    lowPayout: big(r.low_payout),
    mediumPayout: big(r.medium_payout),
    highPayout: big(r.high_payout),
    bond: big(r.bond),
    deadline: num(r.deadline),
    createdAt: num(r.created_at),
    status: String(r.status) as BountyStatus,
    pool: big(r.pool),
    slashed: big(r.slashed),
    reserved: big(r.reserved ?? 0),
    headClaimId: num(r.head_claim_id ?? 0),
    claimIds: (r.claim_ids as unknown[]).map(num),
    acceptedIds: (r.accepted_ids as unknown[]).map(num),
    claimCount: num(r.claim_count),
    pendingCount: num(r.pending_count),
    withdrawable: big(r.withdrawable),
  };
}

export function toClaim(r: Raw): Claim {
  return {
    id: num(r.id),
    bountyId: num(r.bounty_id),
    researcher: addr(r.researcher),
    url: String(r.url),
    evidenceHash: String(r.evidence_hash ?? ""),
    bond: big(r.bond),
    status: String(r.status) as ClaimStatus,
    evidenceAvailable: nullable(r.evidence_available, Boolean),
    demonstrated: nullable(r.demonstrated, Boolean),
    inScope: nullable(r.in_scope, Boolean),
    duplicateOf: nullable(r.duplicate_of, num),
    severity: nullable(r.severity, (x) => String(x) as Severity),
    payout: big(r.payout),
    bondOutcome: String(r.bond_outcome) as BondOutcome,
    evidenceState: String(r.evidence_state ?? "") as EvidenceState,
    note: String(r.note ?? ""),
    attempts: num(r.attempts ?? 0),
    lastAttemptAt: num(r.last_attempt_at ?? 0),
    expiresAt: num(r.expires_at ?? 0),
    createdAt: num(r.created_at),
    resolvedAt: num(r.resolved_at),
  };
}

export function toParams(r: Raw): Params {
  return {
    retryGap: num(r.retry_gap),
    maxUnavailable: num(r.max_unavailable),
    claimExpiry: num(r.claim_expiry),
    maxAccepted: num(r.max_accepted),
  };
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** The contract's own refusal text: base64 (tag byte + utf-8) in a dry-run error or a leader receipt. */
export function decodeRevert(payload: unknown): string | undefined {
  if (typeof payload !== "string" || payload === "") return undefined;
  try {
    const bytes = fromB64(payload);
    const text = new TextDecoder().decode(bytes.subarray(bytes[0] !== undefined && bytes[0] <= 8 ? 1 : 0));
    return /^[\x20-\x7e]{1,80}$/.test(text) ? text : undefined;
  } catch {
    return undefined;
  }
}

export const REFUSALS: Record<string, string> = {
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
  "unknown bounty": "That bounty does not exist.",
  "unknown claim": "That claim does not exist.",
  "bad judgment": "The jury returned something unusable. Nothing moved. The claim is still waiting; try resolving again.",
  "bad hash": "The evidence fingerprint must be 64 lowercase hex characters.",
  "resolve earlier claim first": "Claims are judged in the order they were filed. An earlier claim on this bounty must be settled first.",
  "retry too soon": "The page could not be loaded last time. Retries are spaced apart; try again after the wait shown on the claim.",
  "claim expired": "This claim has been waiting too long to be judged. Expire it to return the bond and move the queue on.",
  "not expired yet": "A claim can only be expired after its waiting window has passed.",
  "nothing to recover": "No failed payment is waiting for this address.",
};

/** Refusals that depend on the clock; a dry run may see a stale time, so they never block a send. */
export const TIME_DEPENDENT = new Set(["too late", "bad deadline", "nothing to withdraw", "retry too soon", "claim expired", "not expired yet"]);

export function describeError(e: unknown): string {
  const cause = (e as { cause?: { data?: { receipt?: { result?: unknown } } } })?.cause;
  const decoded = decodeRevert(cause?.data?.receipt?.result);
  if (decoded) return REFUSALS[decoded] ?? decoded;
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied|4001/i.test(msg)) return "You declined the request in your wallet.";
  return msg.length > 300 ? msg.slice(0, 300) + "…" : msg;
}

/** The raw refusal key (e.g. "bad url") behind an error, if the contract produced one. */
export function refusalKey(e: unknown): string | undefined {
  const cause = (e as { cause?: { data?: { receipt?: { result?: unknown } } } })?.cause;
  return decodeRevert(cause?.data?.receipt?.result);
}
