import { createContext, useContext } from "react";

export interface WalletCtx {
  account: string | null;
  connect: () => Promise<void>;
  error: string | null;
}

export const Ctx = createContext<WalletCtx>({ account: null, connect: async () => {}, error: null });
export const useWallet = () => useContext(Ctx);
