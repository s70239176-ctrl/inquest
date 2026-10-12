import { useState, type ReactNode } from "react";
import type { TxState } from "../hooks.ts";
import { shortAddr } from "../lib/format.ts";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="21" height="21" rx="3" stroke="#e8b04a" strokeWidth="1.6" />
      <path d="M7 12.5l3.2 3.2L17 8.5" stroke="#e8b04a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PHASE_TEXT = {
  signing: "Waiting for the signature…",
  pending: "Sent. The validators are fetching the page and forming a verdict…",
  accepted:
    "The validators agreed. Waiting for finalization: GEN moves only when this finalizes, and the protocol appeal window is open until then.",
  finalized: "Finalized.",
} as const;

export function TxStatus({ state, doneText = "Done." }: { state: TxState; doneText?: string }) {
  if (state.kind === "idle") return null;
  if (state.kind === "running")
    return (
      <div className="tx" role="status">
        {PHASE_TEXT[state.phase]} {state.detail && <span className="muted mono">[{state.detail}]</span>}
      </div>
    );
  if (state.kind === "error")
    return (
      <div className="tx err" role="alert">
        {state.message}
      </div>
    );
  const o = state.outcome;
  if (o.error) {
    return (
      <div className="tx err" role="alert">
        {o.error} <Copy text={o.hash} label={`tx ${shortAddr(o.hash)}`} />
      </div>
    );
  }
  return (
    <div className="tx ok" role="status">
      {doneText} <Copy text={o.hash} label={`tx ${shortAddr(o.hash)}`} />
    </div>
  );
}

export function Chip({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="muted">—</span>;
  return <span className={`chip ${value}`}>{value}</span>;
}

export function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className="v">{children}</span>
    </div>
  );
}

export function Stat({ k, v, s }: { k: string; v: ReactNode; s?: ReactNode }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${92 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="tx err" role="alert">
      {message}{" "}
      {onRetry && (
        <button className="ghost small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Click to copy; shows the short label. */
export function Copy({ text, label }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <span
      className="copy mono"
      title={`Copy ${text}`}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          },
          () => {},
        );
      }}
    >
      {done ? "copied" : (label ?? shortAddr(text))}
    </span>
  );
}
