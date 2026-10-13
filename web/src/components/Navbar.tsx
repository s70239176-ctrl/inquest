import { useState } from "react";
import { Menu, Wallet, X } from "lucide-react";
import { NETWORK } from "../lib/chain.ts";
import { shortAddr } from "../lib/format.ts";
import { useSession } from "../wallet-context.ts";
import { Logo } from "./Ui.tsx";

type Section = "home" | "create" | "mine";

const LINKS: { id: Section; label: string; href: string }[] = [
  { id: "home", label: "Bounties", href: "#/" },
  { id: "create", label: "Create", href: "#/create" },
  { id: "mine", label: "Mine", href: "#/mine" },
];

export function Navbar({ active }: { active: Section }) {
  const { signer, connectWallet, useDemoAccount, disconnect } = useSession();
  const [open, setOpen] = useState(false);

  const linkClass = (on: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-paper-2 text-ink" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-page items-center gap-4 px-5 py-3">
        <a href="#/" className="flex items-center gap-2.5 text-ink no-underline hover:no-underline" aria-label="Inquest home">
          <Logo size={26} />
          <span className="text-[17px] font-bold tracking-tight">Inquest</span>
        </a>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <a key={l.id} href={l.href} className={`${linkClass(active === l.id)} no-underline hover:no-underline`} aria-current={active === l.id ? "page" : undefined}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 font-mono text-[11px] text-ink-soft sm:inline-flex" title="Network">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600" aria-hidden="true" />
            {NETWORK}
          </span>

          {signer ? (
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink"
                title={signer.address}
              >
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-600" />
                </span>
                {signer.kind === "sandbox" && <span className="text-ink-soft">demo</span>}
                {shortAddr(signer.address)}
              </span>
              <button className="ghost small hidden sm:inline-flex" onClick={disconnect}>
                {signer.kind === "sandbox" ? "Reset" : "Disconnect"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button className="small inline-flex items-center gap-1.5" onClick={connectWallet}>
                <Wallet size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Connect wallet</span>
                <span className="sm:hidden">Connect</span>
              </button>
              <button className="ghost small hidden sm:inline-flex" onClick={useDemoAccount}>
                Use demo account
              </button>
            </div>
          )}

          <button
            className="ghost inline-flex h-9 w-9 items-center justify-center !p-0 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-paper px-5 py-3 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {LINKS.map((l) => (
              <a key={l.id} href={l.href} onClick={() => setOpen(false)} className={`${linkClass(active === l.id)} no-underline hover:no-underline`}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap gap-2">
            {signer ? (
              <button className="ghost small" onClick={() => { disconnect(); setOpen(false); }}>
                {signer.kind === "sandbox" ? "Reset demo account" : "Disconnect"}
              </button>
            ) : (
              <button className="ghost small" onClick={() => { useDemoAccount(); setOpen(false); }}>
                Use demo account
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
