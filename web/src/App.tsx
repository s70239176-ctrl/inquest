import { useCallback, useEffect, useState } from "react";
import { Ctx } from "./wallet-context.ts";
import { connectWallet, activeAccount, getProvider } from "./lib/wallet.ts";
import { hasContract, describeError } from "./lib/chain.ts";
import { shortAddr } from "./lib/format.ts";
import { Bounties } from "./screens/Bounties.tsx";
import { Create } from "./screens/Create.tsx";
import { BountyPage } from "./screens/BountyPage.tsx";
import { ClaimPage } from "./screens/ClaimPage.tsx";
import { Mine } from "./screens/Mine.tsx";

function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function App() {
  const hash = useHashRoute();
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    activeAccount().then(setAccount).catch(() => {});
    const provider = getProvider() as (ReturnType<typeof getProvider> & { on?: (e: string, f: (a: string[]) => void) => void }) | undefined;
    provider?.on?.("accountsChanged", (a) => setAccount(a[0] ?? null));
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      setAccount(await connectWallet());
    } catch (e) {
      setError(describeError(e));
    }
  }, []);

  const parts = hash.replace(/^#\/?/, "").split("/");
  let page = <Bounties />;
  if (parts[0] === "create") page = <Create />;
  else if (parts[0] === "b" && parts[1]) page = <BountyPage id={Number(parts[1])} />;
  else if (parts[0] === "c" && parts[1]) page = <ClaimPage id={Number(parts[1])} />;
  else if (parts[0] === "mine") page = <Mine />;

  const nav = (to: string, label: string, on: boolean) => (
    <a href={to} className={on ? "on" : ""}>{label}</a>
  );

  return (
    <Ctx.Provider value={{ account, connect, error }}>
      <div className="wrap">
        <header className="top">
          <a className="brand" href="#/">Inquest</a>
          <span className="tag">A bug isn't real until it repros.</span>
          <nav>
            {nav("#/", "Bounties", parts[0] === "" || parts[0] === "b" || parts[0] === "c")}
            {nav("#/create", "Create", parts[0] === "create")}
            {nav("#/mine", "Mine", parts[0] === "mine")}
          </nav>
          <span className="spacer" />
          {account ? (
            <span className="mono muted">{shortAddr(account)}</span>
          ) : (
            <button onClick={connect}>Connect wallet</button>
          )}
        </header>
        {error && <div className="tx err">{error}</div>}
        {!hasContract && (
          <div className="tx err">
            No contract is configured. Set <span className="mono">VITE_CONTRACT_ADDRESS</span> to a deployed Inquest address on Studionet.
          </div>
        )}
        {page}
        <p className="notice">
          Inquest reads one public writeup. It never runs a proof of concept, never follows links inside a writeup and never sends
          traffic to a target. It is not legal advice and does not certify that any software is secure. If the jury cannot decide,
          no GEN moves.
        </p>
      </div>
    </Ctx.Provider>
  );
}
