import type { ReactNode } from "react";
import type { TxState } from "../hooks.ts";
import { shortAddr } from "../lib/format.ts";

const PHASE_TEXT = {
  signing: "Waiting for your wallet to sign…",
  pending: "Sent. Waiting for the validators to reach a verdict…",
  accepted: "Validators agreed. Waiting for finalization. GEN moves only when this finalizes, and the protocol appeal window is open until then.",
  finalized: "Finalized.",
} as const;

export function TxStatus({ state }: { state: TxState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "running")
    return (
      <div className="tx">
        {PHASE_TEXT[state.phase]} {state.detail && <span className="muted mono">[{state.detail}]</span>}
      </div>
    );
  if (state.kind === "error") return <div className="tx err">{state.message}</div>;
  const o = state.outcome;
  if (o.error) {
    return (
      <div className="tx err">
        {o.error} <span className="muted mono">tx {shortAddr(o.hash)}</span>
      </div>
    );
  }
  return (
    <div className="tx ok">
      Done. <span className="muted mono">tx {o.hash}</span>
    </div>
  );
}

export function Pill({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="muted">—</span>;
  return <span className={`pill ${value}`}>{value}</span>;
}

export function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className="v">{children}</span>
    </div>
  );
}

export function Loading({ what }: { what: string }) {
  return <p className="muted">Loading {what}…</p>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="tx err">
      {message} {onRetry && <button className="ghost" onClick={onRetry}>Retry</button>}
    </div>
  );
}
