import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { connectWallet, currentAccount, getEthereum } from "./genlayer";

type WalletState = {
  address: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
};

const WalletContext = createContext<WalletState>({
  address: null,
  connecting: false,
  error: null,
  connect: async () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pick up an already-authorised account without prompting.
  useEffect(() => {
    let alive = true;
    void currentAccount().then((a) => {
      if (alive) setAddress(a);
    });

    const eth = getEthereum();
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      setAddress(accounts?.[0] ?? null);
    };
    eth?.on?.("accountsChanged", onAccounts);

    return () => {
      alive = false;
      eth?.removeListener?.("accountsChanged", onAccounts);
    };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      setAddress(await connectWallet());
    } catch (err) {
      setError((err as { message?: string })?.message ?? String(err));
    } finally {
      setConnecting(false);
    }
  }, []);

  return (
    <WalletContext.Provider value={{ address, connecting, error, connect }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
