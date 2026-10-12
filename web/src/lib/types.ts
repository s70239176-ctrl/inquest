export type BountyStatus = "OPEN" | "DEPLETED" | "CANCELLED";
export type ClaimStatus = "PENDING" | "RESOLVED";
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
  bond: bigint;
  status: ClaimStatus;
  evidenceAvailable: boolean | null;
  demonstrated: boolean | null;
  inScope: boolean | null;
  duplicateOf: number | null;
  severity: Severity | null;
  payout: bigint;
  bondOutcome: BondOutcome;
  createdAt: number;
  resolvedAt: number;
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
}
