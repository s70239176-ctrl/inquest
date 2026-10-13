import { useState, type ReactNode } from "react";
import type { TxState } from "../hooks.ts";
import { shortAddr } from "../lib/format.ts";

/**
 * The Inquest mark: a hexagon (the six-validator jury) around a lowercase i whose stem runs into a plumb bob, the
 * instrument for checking what is truly vertical. `ink` is for light surfaces, `reverse` for dark ones.
 */
export function Logo({ size = 22, tone = "reverse" }: { size?: number; tone?: "ink" | "reverse" }) {
  const line = tone === "ink" ? "#171713" : "#F1F0EA";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <polygon points="32.00,4.00 56.25,18.00 56.25,46.00 32.00,60.00 7.75,46.00 7.75,18.00" stroke={line} strokeWidth="3.4" strokeLinejoin="round" />
      <circle cx="32" cy="15.9" r="3.5" fill="#D6A844" />
      <rect x="30" y="22.2" width="4" height="12.6" fill={line} />
      <path d="M32 34.2 40.8 43 32 51.8 23.2 43Z" fill="#D6A844" />
    </svg>
  );
}

/** Mark plus wordmark. The wordmark is bold, uppercase and widely tracked, as in the original header. */
export function Brand({ tone, size = 28 }: { tone: "ink" | "reverse"; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Logo size={size} tone={tone} />
      <span className="text-[15px] font-semibold uppercase leading-none tracking-[0.22em]">Inquest</span>
    </span>
  );
}

const PHASE_TEXT = {
  signing: "Waiting for the signature…",
  pending: "Sent. Waiting for the validators to process it…",
  accepted: "The validators accepted it. Waiting for finalization: GEN moves only when this finalizes.",
  finalized: "Finalized.",
} as const;

/** Wording for the jury round (resolve_claim): the validators fetch the page and answer the five fields. */
const JUDGING_TEXT = {
  ...PHASE_TEXT,
  pending: "Sent. Each validator is fetching the page itself and forming its own verdict…",
  accepted:
    "The validators agreed. Waiting for finalization: GEN moves only when this finalizes, and the protocol appeal window is open until then.",
} as const;

export function TxStatus({ state, doneText = "Done.", judging = false }: { state: TxState; doneText?: string; judging?: boolean }) {
  if (state.kind === "idle") return null;
  if (state.kind === "running")
    return (
      <div className="tx" role="status">
        {(judging ? JUDGING_TEXT : PHASE_TEXT)[state.phase]} {state.detail && <span className="muted mono">[{state.detail}]</span>}
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
