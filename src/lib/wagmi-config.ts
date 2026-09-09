import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { studioDevnet, studionet, testnetBradbury } from "genlayer-js/chains";
import { CHAIN_NAME } from "./genlayer";

// Mirrors genlayer.ts's getChain() switch so the write side (wagmi) and the
// read side (readClient) can never silently point at different chains.
const chain =
  CHAIN_NAME === "studionet" ? studionet : CHAIN_NAME === "testnetBradbury" ? testnetBradbury : studioDevnet;

const projectId = import.meta.env["VITE_WALLETCONNECT_PROJECT_ID"] as string | undefined;

if (!projectId && typeof window !== "undefined") {
  console.warn(
    "VITE_WALLETCONNECT_PROJECT_ID is not set - the WalletConnect QR flow " +
      "won't work until you add one. Browser-extension wallets (MetaMask, etc.) still connect fine.",
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: "HELIX",
  // getDefaultConfig throws on a falsy projectId, which would crash SSR
  // entirely before a real one is configured - fall back to a placeholder
  // so the app (and every non-WalletConnect connector) keeps working.
  projectId: projectId || "00000000000000000000000000000000",
  chains: [chain],
  ssr: true,
});
