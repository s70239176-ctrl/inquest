export type BountyStatus = "OPEN" | "DEPLETED" | "CANCELLED";
export type ClaimStatus = "PENDING" | "RESOLVED" | "EXPIRED";
export type EvidenceState = "" | "unavailable" | "ok" | "changed" | "withdrawn" | "expired";
export type Severity = "none" | "low" | "medium" | "high";
export type BondOutcome = "NONE" | "RETURNED" | "SLASHED";

export interface Bounty {
  id: number;
  project: string;
  title: string;
  repoUrl: string;
  rubric: string;
  lowPayout: bigint;
  mediumPayout: bigint;
  highPayout: bigint;
  bond: bigint;
  deadline: number;
  createdAt: number;
  status: BountyStatus;
  pool: bigint;
  slashed: bigint;
  /** GEN held back for claims still pending (never withdrawable while they wait). */
  reserved: bigint;
  /** The oldest pending claim: the only one that can be judged next (submission order is precedence). 0 = none. */
  headClaimId: number;
  claimIds: number[];
  acceptedIds: number[];
  claimCount: number;
  pendingCount: number;
  withdrawable: bigint;
}

export interface Claim {
  id: number;
  bountyId: number;
  researcher: string;
  url: string;
  /** sha256 of the cleaned page, committed at submission. */
  evidenceHash: string;
  bond: bigint;
  status: ClaimStatus;
  evidenceAvailable: boolean | null;
  demonstrated: boolean | null;
  inScope: boolean | null;
  duplicateOf: number | null;
  severity: Severity | null;
  payout: bigint;
  bondOutcome: BondOutcome;
  evidenceState: EvidenceState;
  /** "" | evidence_changed | evidence_withdrawn | expired | bounty_full | pool_empty */
  note: string;
  attempts: number;
  lastAttemptAt: number;
  expiresAt: number;
  createdAt: number;
  resolvedAt: number;
}

export interface Params {
  retryGap: number;
  maxUnavailable: number;
  claimExpiry: number;
  maxAccepted: number;
}

export interface Page<T> {
  total: number;
  items: T[];
}

export type Phase = "signing" | "pending" | "accepted" | "finalized";

export interface TxOutcome {
  hash: string;
  status: string;
  /** Plain-language reason when the transaction did not settle or the contract refused it. */
  error?: string;
  /** The string a successful call returned (for example resolve_claim: "unavailable", a band, or "SLASHED"). */
  result?: string;
}
