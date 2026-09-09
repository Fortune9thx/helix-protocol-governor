import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { createClient } from "genlayer-js";
import { wagmiConfig } from "./wagmi-config";
import type { GenLayerClient, GenLayerChain } from "genlayer-js/types";

/**
 * The write client, bound to the wallet's real connected provider.
 *
 * Reading window.ethereum directly assumed the connected wallet is always
 * the one injected provider a page happens to see - true only for a single
 * browser-extension wallet. Any other connector (WalletConnect, Coinbase
 * Smart Wallet, Safe, or even a second installed extension shadowing
 * window.ethereum) leaves this null forever while the wallet is genuinely
 * connected. connector.getProvider() returns whichever EIP-1193 provider
 * wagmi actually established the connection through, matching every
 * connector type instead of guessing at the global.
 */
export function useHelixWallet(): {
  client: GenLayerClient<GenLayerChain> | null;
  address: `0x${string}` | undefined;
  connecting: boolean;
  clientError: string | null;
  openConnectModal: (() => void) | undefined;
} {
  const { address, isConnected, connector, status } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [client, setClient] = useState<GenLayerClient<GenLayerChain> | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isConnected || !address || !connector) {
      setClient(null);
      return;
    }
    connector
      .getProvider()
      .then((provider) => {
        if (cancelled) return;
        setClientError(null);
        setClient(
          createClient({
            chain: wagmiConfig.chains[0],
            account: address,
            // wagmi's connector.getProvider() is typed as Promise<unknown> -
            // it's a real EIP-1193 provider at runtime for every connector
            // type, exactly the shape genlayer-js's createClient expects.
            provider: provider as never,
          } as never),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setClient(null);
        setClientError((err as { message?: string })?.message ?? String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, connector]);

  return {
    client,
    address,
    connecting: status === "connecting" || status === "reconnecting",
    clientError,
    openConnectModal,
  };
}
