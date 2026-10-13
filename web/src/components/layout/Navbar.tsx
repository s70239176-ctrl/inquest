import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy as CopyIcon, LogOut, Menu, User, Wallet, X } from "lucide-react";
import { NETWORK } from "../../lib/chain.ts";
import { shortAddr } from "../../lib/format.ts";
import { useSession } from "../../wallet-context.ts";
import { Logo } from "../Ui.tsx";

export type Section = "home" | "bounties" | "create" | "mine";
export type Tone = "ivory" | "dark";

const LINKS: { id: Section; label: string; href: string }[] = [
  { id: "bounties", label: "Bounties", href: "#/bounties" },
  { id: "create", label: "Create", href: "#/create" },
  { id: "mine", label: "Mine", href: "#/mine" },
];

const T = {
  ivory: {
    bar: "border-ivory-line bg-ivory text-ivory-ink",
    mark: "text-ivory-ink",
    linkOn: "bg-ivory-2 text-ivory-ink",
    linkOff: "text-ivory-muted hover:bg-ivory-2 hover:text-ivory-ink",
    chip: "border-ivory-line bg-white/60 text-ivory-muted",
    menu: "border-ivory-line bg-ivory text-ivory-ink shadow-[0_18px_40px_-18px_rgba(23,23,19,0.35)]",
    menuItem: "hover:bg-ivory-2",
    muted: "text-ivory-muted",
    ghost: "!border !border-ivory-line !bg-transparent !text-ivory-ink hover:!bg-ivory-2",
  },
  dark: {
    bar: "border-app-line bg-app-bg text-app-text",
    mark: "text-app-text",
    linkOn: "bg-app-raised text-app-text",
    linkOff: "text-app-soft hover:bg-app-raised hover:text-app-text",
    chip: "border-app-line bg-app-surface text-app-soft",
    menu: "border-app-line bg-app-surface text-app-text shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]",
    menuItem: "hover:bg-app-raised",
    muted: "text-app-soft",
    ghost: "ghost",
  },
} as const;

function WalletMenu({ tone }: { tone: Tone }) {
  const { signer, disconnect } = useSession();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const c = T[tone];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!signer) return null;
  const demo = signer.kind === "sandbox";
  const item = `!flex !w-full !items-center !gap-2.5 !rounded-lg !bg-transparent !px-3 !py-2 !text-left !text-[13px] !font-medium !text-inherit ${c.menuItem}`;

  return (
    <div className="relative" ref={box}>
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`!inline-flex !items-center !gap-2 !rounded-full !border !bg-transparent !px-3 !py-1.5 !font-mono !text-xs !font-medium hover:!bg-transparent ${c.chip}`}
      >
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
        </span>
        {demo && <span className="opacity-70">demo</span>}
        <span className={c.mark}>{shortAddr(signer.address)}</span>
        <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className={`absolute right-0 z-40 mt-2 w-60 animate-rise rounded-xl border p-1.5 ${c.menu}`}>
          <div className={`px-3 pb-2 pt-1.5 text-[11px] ${c.muted}`}>
            {demo ? "Demo account · test GEN only" : "Browser wallet"}
            <div className="mt-1 break-all font-mono text-[11px] opacity-80">{signer.address}</div>
          </div>
          <button
            role="menuitem"
            onClick={() => {
              navigator.clipboard?.writeText(signer.address).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              });
            }}
            className={item}
          >
            {copied ? <Check size={15} /> : <CopyIcon size={15} />} {copied ? "Copied" : "Copy address"}
          </button>
          <a
            role="menuitem"
            href="#/mine"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium !text-inherit no-underline hover:no-underline ${c.menuItem}`}
          >
            <User size={15} /> My dashboard
          </a>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              disconnect();
            }}
            className={item}
          >
            <LogOut size={15} /> {demo ? "Reset demo account" : "Disconnect"}
          </button>
        </div>
      )}
    </div>
  );
}

export function Navbar({ active, tone }: { active: Section; tone: Tone }) {
  const { signer, connectWallet, useDemoAccount } = useSession();
  const [open, setOpen] = useState(false);
  const c = T[tone];

  const link = (on: boolean) =>
    `rounded-md px-3 py-1.5 text-[13.5px] font-medium no-underline transition-colors hover:no-underline ${on ? c.linkOn : c.linkOff} !text-current`;

  return (
    <header className={`sticky top-0 z-30 border-b backdrop-blur ${c.bar}`}>
      <div className="mx-auto grid max-w-page grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3">
        <a href="#/" className={`flex items-center gap-2.5 no-underline hover:no-underline ${c.mark} !text-current`} aria-label="Inquest home">
          <Logo size={26} />
          <span className="text-[15px] font-semibold uppercase tracking-[0.22em]">Inquest</span>
        </a>

        <nav className="hidden items-center justify-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <a key={l.id} href={l.href} className={link(active === l.id)} aria-current={active === l.id ? "page" : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
        <span className="md:hidden" />

        <div className="flex items-center justify-end gap-2.5">
          <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] sm:inline-flex ${c.chip}`} title="Network">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
            {NETWORK}
          </span>

          {signer ? (
            <WalletMenu tone={tone} />
          ) : (
            <div className="flex items-center gap-2">
              <button className="small !inline-flex !items-center !gap-1.5" onClick={connectWallet}>
                <Wallet size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Connect wallet</span>
                <span className="sm:hidden">Connect</span>
              </button>
              <button className={`small hidden sm:inline-flex ${c.ghost}`} onClick={useDemoAccount}>
                Demo account
              </button>
            </div>
          )}

          <button
            className={`inline-flex h-9 w-9 items-center justify-center !p-0 md:hidden ${c.ghost}`}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className={`animate-rise border-t px-5 py-3 md:hidden ${tone === "ivory" ? "border-ivory-line bg-ivory" : "border-app-line bg-app-bg"}`}>
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {LINKS.map((l) => (
              <a key={l.id} href={l.href} onClick={() => setOpen(false)} className={link(active === l.id)}>
                {l.label}
              </a>
            ))}
          </nav>
          {!signer && (
            <div className="mt-3">
              <button
                className={`small ${c.ghost}`}
                onClick={() => {
                  useDemoAccount();
                  setOpen(false);
                }}
              >
                Use demo account
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
