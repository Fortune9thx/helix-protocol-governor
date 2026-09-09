/**
 * GenLayer wiring for HELIX.
 *
 * genlayer-js is imported dynamically for reads so the SSR pass never pulls
 * the browser/wallet stack into the server bundle. Wallet connection and
 * write-client construction live in wallet.tsx/wagmi-config.ts (RainbowKit +
 * wagmi, matching every other GenLayer build here) - this file no longer
 * touches window.ethereum directly.
 */

const env = import.meta.env as Record<string, string | undefined>;

export const CHAIN_NAME = env["VITE_GENLAYER_CHAIN"] ?? "studioDevnet";
export const HOST_VAULT_ADDRESS = env["VITE_HOST_VAULT_ADDRESS"] ?? "";
export const HELIX_ADDRESS = env["VITE_HELIX_ADDRESS"] ?? "";
export const GENOME_REGISTRY_ADDRESS = env["VITE_GENOME_REGISTRY_ADDRESS"] ?? "";
export const EVIDENCE_DRAIN_URL = env["VITE_EVIDENCE_DRAIN_URL"] ?? "";
export const EVIDENCE_PHISH_URL = env["VITE_EVIDENCE_PHISH_URL"] ?? "";

export const isConfigured = () => HOST_VAULT_ADDRESS !== "" && HELIX_ADDRESS !== "";

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
