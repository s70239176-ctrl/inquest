import type { Tone } from "../../lib/view.ts";

const TONES: Record<Tone, string> = {
  gold: "border-gold/40 bg-gold/10 text-gold",
  green: "border-ok/40 bg-ok/10 text-ok",
  amber: "border-pending/45 bg-pending/10 text-pending",
  gray: "border-app-line bg-app-raised text-neutral",
  red: "border-adverse/45 bg-adverse/10 text-adverse",
};

/** Status pill for the dark application surface. The label always comes from real protocol state. */
export function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${TONES[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      {label}
    </span>
  );
}
