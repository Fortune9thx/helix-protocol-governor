/**
 * Typed reads/writes against the deployed HELIX contracts.
 *
 * HostVault.get_state()  -> "version||frozen||max_approval||constitution||patch||family||mutation||organ_count"
 * Helix.get_status()     -> "count||family||patch||rationale||urls||organ"
 *
 * studio-dev (consensus v0.6 RC) is fee-funded: every deploy/write must
 * carry an SDK fee estimate, and success is only proven once a transaction
 * is FINALIZED with FINISHED_WITH_RETURN - see
 * https://docs.genlayer.com/developers/consensus-v06-migration
 */

import { HELIX_ADDRESS, HOST_VAULT_ADDRESS, readClient, writeClient } from "./genlayer";

export type HostState = {
  genomeVersion: string;
  frozen: boolean;
  maxApproval: string;
  constitution: string;
  lastPatchId: string;
  lastThreatFamily: string;
  lastMutation: string;
  organCount: string;
};

export type HelixStatus = {
  mutationCount: string;
  lastFamily: string;
  lastPatch: string;
  lastRationale: string;
  lastUrls: string;
  lastOrgan: string;
};

export function parseHostState(raw: string): HostState {
  const p = raw.split("||");
  return {
    genomeVersion: p[0] ?? "",
    frozen: p[1] === "1",
    maxApproval: p[2] ?? "0",
    constitution: p[3] ?? "",
    lastPatchId: p[4] ?? "NONE",
    lastThreatFamily: p[5] ?? "",
    lastMutation: p[6] ?? "",
    organCount: p[7] ?? "0",
  };
}

export function parseHelixStatus(raw: string): HelixStatus {
  const p = raw.split("||");
  return {
    mutationCount: p[0] ?? "0",
    lastFamily: p[1] ?? "",
    lastPatch: p[2] ?? "NONE",
    lastRationale: p[3] ?? "",
    lastUrls: p[4] ?? "",
    lastOrgan: p[5] ?? "",
  };
}

export async function readHostState(): Promise<HostState> {
  const client = await readClient();
  const raw = (await client.readContract({
    address: HOST_VAULT_ADDRESS as `0x${string}`,
    functionName: "get_state",
    args: [],
  })) as string;
  return parseHostState(raw);
}

export async function readHelixStatus(): Promise<HelixStatus> {
  const client = await readClient();
  const raw = (await client.readContract({
    address: HELIX_ADDRESS as `0x${string}`,
    functionName: "get_status",
    args: [],
  })) as string;
  return parseHelixStatus(raw);
}

async function writeWithFees(
  account: string,
  address: string,
  functionName: string,
  kwargs: object,
): Promise<string> {
  const client = await writeClient(account);
  const estimate = await client.estimateTransactionFees();
  const fees = { distribution: estimate.distribution, feeValue: estimate.feeValue };
  const hash = await client.writeContract({
    address: address as `0x${string}`,
    functionName,
    args: [],
    kwargs,
    value: 0n,
    fees,
  } as never);
  return hash as unknown as string;
}

/** HostVault.approve(spender, amount). Reverts FROZEN_BY_HELIX once spliced. */
export async function approve(account: string, spender: string, amountWei: bigint): Promise<string> {
  return writeWithFees(account, HOST_VAULT_ADDRESS, "approve", { spender, amount: amountWei });
}

/** Helix.ingest_threat(url_a, url_b) — runs the leader/validator consensus round. */
export async function ingestThreat(account: string, urlA: string, urlB: string): Promise<string> {
  return writeWithFees(account, HELIX_ADDRESS, "ingest_threat", { url_a: urlA, url_b: urlB });
}

/** Waits for FINALIZED. Callers should also check the receipt/a fresh read for FINISHED_WITH_RETURN. */
export async function waitForTx(hash: string): Promise<void> {
  const client = await readClient();
  await client.waitForFinalization({ hash, retries: 200, interval: 3000 } as never);
}

/**
 * Turn a thrown wallet/VM error into the short line the theater shows.
 * A frozen vault surfaces as FROZEN_BY_HELIX, which is the whole point.
 */
export function readableError(err: unknown): string {
  const raw =
    typeof err === "string"
      ? err
      : ((err as { shortMessage?: string; message?: string })?.shortMessage ??
        (err as { message?: string })?.message ??
        String(err));
  if (raw.includes("FROZEN_BY_HELIX")) return "FROZEN_BY_HELIX";
  if (raw.includes("above max_approval")) return "above max_approval";
  if (raw.includes("evidence url")) return raw.match(/evidence url[^"\\]*/)?.[0] ?? raw;
  if (/user rejected|denied|4001/i.test(raw)) return "Signature rejected.";
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
}
