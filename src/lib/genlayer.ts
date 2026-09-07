/**
 * GenLayer wiring for HELIX.
 *
 * genlayer-js is imported dynamically everywhere so the SSR pass never pulls
 * the browser/wallet stack into the server bundle. Every export here is
 * client-only and returns early when `window` is absent.
 */

const env = import.meta.env as Record<string, string | undefined>;

export const CHAIN_NAME = env["VITE_GENLAYER_CHAIN"] ?? "studioDevnet";
export const HOST_VAULT_ADDRESS = env["VITE_HOST_VAULT_ADDRESS"] ?? "";
export const HELIX_ADDRESS = env["VITE_HELIX_ADDRESS"] ?? "";
export const GENOME_REGISTRY_ADDRESS = env["VITE_GENOME_REGISTRY_ADDRESS"] ?? "";
export const EVIDENCE_DRAIN_URL = env["VITE_EVIDENCE_DRAIN_URL"] ?? "";
export const EVIDENCE_PHISH_URL = env["VITE_EVIDENCE_PHISH_URL"] ?? "";

export const isConfigured = () => HOST_VAULT_ADDRESS !== "" && HELIX_ADDRESS !== "";

type EthereumProvider = {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum ?? null;
}

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

/**
 * Write client: bound to the wallet's real injected provider, so MetaMask
 * actually raises a signature request.
 */
export async function writeClient(account: string) {
  const { createClient } = await import("genlayer-js");
  const chain = await getChain();
  const provider = getEthereum();
  return createClient({ chain, account, provider } as never);
}

export async function chainIdHex(): Promise<string> {
  const chain = await getChain();
  return `0x${chain.id.toString(16)}`;
}

/** Connect MetaMask and make sure it is pointed at the configured GenLayer chain. */
export async function connectWallet(): Promise<string> {
  const eth = getEthereum();
  if (!eth) throw new Error("MetaMask not found");

  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const account = accounts[0];
  if (!account) throw new Error("No account selected");

  const chain = await getChain();
  const wanted = await chainIdHex();
  const current = (await eth.request({ method: "eth_chainId" })) as string;

  if (current?.toLowerCase() !== wanted.toLowerCase()) {
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: wanted }],
      });
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: wanted,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: [chain.rpcUrls?.default?.http?.[0]].filter(Boolean),
            },
          ],
        });
      } else {
        throw err;
      }
    }
  }

  return account;
}

export async function currentAccount(): Promise<string | null> {
  const eth = getEthereum();
  if (!eth) return null;
  try {
    const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}

export function truncate(addr: string, head = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}
