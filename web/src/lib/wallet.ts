/**
 * Optional browser-wallet signing (EIP-1193, e.g. MetaMask) on Studionet. A signer is either a
 * sandbox private key (0x + 64 hex) or "wallet:<address>"; chain.ts picks the transport from that.
 */
import { studionet } from "genlayer-js/chains";

export interface Eip1193 {
  request: (a: { method: string; params?: unknown[] | object }) => Promise<unknown>;
}

const PREFIX = "wallet:";
export const isWalletSigner = (s: string): boolean => s.startsWith(PREFIX);
export const walletSigner = (address: string): string => PREFIX + address;
export const walletAddress = (s: string): string => s.slice(PREFIX.length);

export const getProvider = (): Eip1193 | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { ethereum?: Eip1193 }).ethereum;

/** The wallet's currently selected account, or null if it is locked or disconnected. */
export async function activeAccount(provider: Eip1193 | undefined = getProvider()): Promise<string | null> {
  if (!provider) return null;
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  return accounts?.[0] ?? null;
}

/** A wallet signs only as its selected account; refuse early, with a plain message, if that changed. */
export async function assertSameAccount(signer: string): Promise<void> {
  const active = await activeAccount();
  if (!active) throw new Error("The wallet is locked or disconnected. Unlock it and choose Connect wallet again.");
  if (active.toLowerCase() !== walletAddress(signer).toLowerCase()) {
    throw new Error(`The wallet is now on ${active.slice(0, 6)}…${active.slice(-4)}, not ${walletAddress(signer).slice(0, 6)}…${walletAddress(signer).slice(-4)}. Choose Connect wallet to use the new account, or switch the wallet back.`);
  }
}

const chainIdHex = `0x${studionet.id.toString(16)}`;

/** Ask the wallet for an account, then add and switch to Studionet if it is on another chain. */
export async function connectWallet(provider: Eip1193 | undefined = getProvider()): Promise<string> {
  if (!provider) throw new Error("No browser wallet found. Install MetaMask, or keep using the sandbox account.");
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("The wallet did not share an account.");
  const current = await provider.request({ method: "eth_chainId" });
  if (String(current).toLowerCase() !== chainIdHex) {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: studionet.name,
          rpcUrls: studionet.rpcUrls.default.http,
          nativeCurrency: studionet.nativeCurrency,
          blockExplorerUrls: studionet.blockExplorers?.default.url ? [studionet.blockExplorers.default.url] : undefined,
        },
      ],
    });
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
  }
  return address;
}
