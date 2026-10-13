import { useCallback, useEffect, useMemo, useState } from "react";
import { Ctx, type Session } from "./wallet-context.ts";
import {
  activeWalletAccount,
  connectWallet,
  createSandbox,
  forgetSandbox,
  getProvider,
  loadSandbox,
  type Signer,
} from "./lib/signer.ts";
import { describeError, hasContract } from "./lib/chain.ts";
import { Navbar } from "./components/Navbar.tsx";
import { Bounties } from "./screens/Bounties.tsx";
import { Create } from "./screens/Create.tsx";
import { BountyPage } from "./screens/BountyPage.tsx";
import { ClaimPage } from "./screens/ClaimPage.tsx";
import { Mine } from "./screens/Mine.tsx";

function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash || "#/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function App() {
  const hash = useHashRoute();
  const [signer, setSigner] = useState<Signer | null>(() => loadSandbox());
  const [error, setError] = useState<string | null>(null);

  // follow the browser wallet when it switches account
  useEffect(() => {
    const provider = getProvider();
    provider?.on?.("accountsChanged", (a) => {
      setSigner((cur) => (cur?.kind === "wallet" ? (a[0] ? { kind: "wallet", address: a[0].toLowerCase() } : null) : cur));
    });
    activeWalletAccount().catch(() => null);
  }, []);

  const doConnect = useCallback(async () => {
    try {
      setError(null);
      setSigner(await connectWallet());
    } catch (e) {
      setError(describeError(e));
    }
  }, []);

  const useDemoAccount = useCallback(() => {
    setError(null);
    setSigner(loadSandbox() ?? createSandbox());
  }, []);

  const disconnect = useCallback(() => {
    if (signer?.kind === "sandbox") forgetSandbox();
    setSigner(null);
  }, [signer]);

  const session: Session = useMemo(
    () => ({
      signer,
      me: signer?.address ?? "",
      connectWallet: doConnect,
      useDemoAccount,
      disconnect,
      requireSigner: () => signer,
      error,
    }),
    [signer, doConnect, useDemoAccount, disconnect, error],
  );

  const parts = hash.replace(/^#\/?/, "").split("/");
  const section = parts[0];
  let page = <Bounties />;
  if (section === "create") page = <Create />;
  else if (section === "b" && parts[1]) page = <BountyPage id={Number(parts[1])} />;
  else if (section === "c" && parts[1]) page = <ClaimPage id={Number(parts[1])} />;
  else if (section === "mine") page = <Mine />;

  return (
    <Ctx.Provider value={session}>
      <Navbar active={section === "create" ? "create" : section === "mine" ? "mine" : "home"} />
      <main className="wrap">
        {error && (
          <div className="tx err" role="alert">
            {error}
          </div>
        )}
        {!hasContract && (
          <div className="tx err" role="alert">
            No contract is configured. Set <span className="mono">VITE_CONTRACT_ADDRESS</span> to a deployed Inquest address on Studionet.
          </div>
        )}
        {signer?.kind === "sandbox" && (
          <div className="banner">
            <b>Demo account.</b> A throwaway key stored in this browser, for Studionet test GEN only. Never send real funds to it.
          </div>
        )}
        {page}
        <p className="footer">
          Inquest reads one public writeup. It never runs a proof of concept, never follows links inside a writeup and never sends traffic
          to a target. It is not legal advice and does not certify that any software is secure. If the jury cannot decide, no GEN moves.
        </p>
      </main>
    </Ctx.Provider>
  );
}
