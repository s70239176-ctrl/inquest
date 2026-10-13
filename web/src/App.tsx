import { useCallback, useEffect, useMemo, useState } from "react";
import { Ctx, type Session } from "./wallet-context.ts";
import { connectWallet, createSandbox, forgetSandbox, getProvider, loadSandbox, type Signer } from "./lib/signer.ts";
import { describeError, hasContract } from "./lib/chain.ts";
import { Navbar, type Section } from "./components/layout/Navbar.tsx";
import { Footer } from "./components/layout/Footer.tsx";
import { Home } from "./screens/Home.tsx";
import { BountiesPage } from "./screens/BountiesPage.tsx";
import { Create } from "./screens/Create.tsx";
import { BountyPage } from "./screens/BountyPage.tsx";
import { ClaimPage } from "./screens/ClaimPage.tsx";
import { Mine } from "./screens/Mine.tsx";

function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    let last = (window.location.hash || "#/").split("/").slice(0, 3).join("/");
    const on = () => {
      const next = window.location.hash || "#/";
      setHash(next);
      // moving between tabs of the same bounty keeps your scroll position; any other navigation starts at the top
      const key = next.split("/").slice(0, 3).join("/");
      const sameBounty = next.startsWith("#/b/") && last.startsWith("#/b/") && key === last;
      last = key;
      if (!sameBounty) window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

/**
 * Routes (all hash-based, so deep links work on any static host):
 *   #/  #/bounties  #/create  #/mine  #/b/:id[/rubric|writeups|jury|activity]  #/c/:id
 */
export function App() {
  const hash = useHashRoute();
  const [signer, setSigner] = useState<Signer | null>(() => loadSandbox());
  const [error, setError] = useState<string | null>(null);

  // follow the browser wallet when it switches account
  useEffect(() => {
    getProvider()?.on?.("accountsChanged", (a) => {
      setSigner((cur) => (cur?.kind === "wallet" ? (a[0] ? { kind: "wallet", address: a[0].toLowerCase() } : null) : cur));
    });
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
    () => ({ signer, me: signer?.address ?? "", connectWallet: doConnect, useDemoAccount, disconnect, requireSigner: () => signer, error }),
    [signer, doConnect, useDemoAccount, disconnect, error],
  );

  const parts = hash.replace(/^#\/?/, "").split("/");
  const route = parts[0];

  let page = <Home />;
  let active: Section = "home";
  let editorial = true;
  if (route === "bounties") {
    page = <BountiesPage />;
    active = "bounties";
    editorial = false;
  } else if (route === "create") {
    page = <Create />;
    active = "create";
    editorial = false;
  } else if (route === "mine") {
    page = <Mine />;
    active = "mine";
    editorial = false;
  } else if (route === "b" && parts[1]) {
    page = <BountyPage id={Number(parts[1])} tab={parts[2]} />;
    active = "bounties";
    editorial = false;
  } else if (route === "c" && parts[1]) {
    page = <ClaimPage id={Number(parts[1])} />;
    active = "bounties";
    editorial = false;
  }

  const banners = (
    <>
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
    </>
  );

  return (
    <Ctx.Provider value={session}>
      <Navbar active={active} tone={editorial ? "ivory" : "dark"} />
      {editorial ? (
        <>
          {(error || !hasContract || signer?.kind === "sandbox") && (
            <div className="ivory-scope flow-root bg-ivory px-5 pt-3">
              <div className="mx-auto max-w-page">{banners}</div>
            </div>
          )}
          <main>{page}</main>
          <Footer tone="dark" />
        </>
      ) : (
        <>
          <main className="wrap">{banners}{page}</main>
          <Footer tone="dark" />
        </>
      )}
    </Ctx.Provider>
  );
}
