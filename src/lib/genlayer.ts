/**
 * GenLayer wiring for HELIX.
 *
 * genlayer-js is imported dynamically for reads so the SSR pass never pulls
 * the browser/wallet stack into the server bundle. Wallet connection and
 * write-client construction live in wallet.tsx/wagmi-config.ts (RainbowKit +
 * wagmi, matching every other GenLayer build here) - this file no longer
 * touches window.ethereum directly.
 *
 * Contract addresses come from addresses.json (written by scripts/deploy.ts)
 * - the one source of truth for the registry/Helix/host addresses, so .env,
 * README, and Vercel env can never drift from each other or from what's
 * actually deployed.
 */
import addressesFile from "../../addresses.json";

const env = import.meta.env as Record<string, string | undefined>;

export const CHAIN_NAME = env["VITE_GENLAYER_CHAIN"] ?? addressesFile.network.chain;
export const EVIDENCE_DRAIN_URL = env["VITE_EVIDENCE_DRAIN_URL"] ?? "";
export const EVIDENCE_PHISH_URL = env["VITE_EVIDENCE_PHISH_URL"] ?? "";

export type HostEntry = { address: string; label: string };

export const GENOME_REGISTRY_ADDRESS = addressesFile.genomeRegistry;
export const HELIX_ADDRESS = addressesFile.helix;
export const HOSTS: HostEntry[] = addressesFile.hosts;

export const isConfigured = () => HELIX_ADDRESS !== "" && HOSTS.length > 0;

export async function getChain() {
  const chains = await import("genlayer-js/chains");
  switch (CHAIN_NAME) {
    case "studionet":
      return chains.studionet;
    case "testnetBradbury":
      return chains.testnetBradbury;
    case "studioDevnet":
    default:
      return chains.studioDevnet;
  }
}

/**
 * Read client: no account, no provider. Constructing an account just to read
 * would generate a throwaway key and trigger repeated wallet prompts.
 */
export async function readClient() {
  const { createClient } = await import("genlayer-js");
  const chain = await getChain();
  return createClient({ chain } as never);
}

export function truncate(addr: string, head = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}
