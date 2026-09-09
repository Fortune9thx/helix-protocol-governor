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

import { HELIX_ADDRESS, HOST_VAULT_ADDRESS, readClient } from "./genlayer";
import { isSuccessful } from "genlayer-js";
import type { GenLayerClient, GenLayerChain } from "genlayer-js/types";

type WriteClient = GenLayerClient<GenLayerChain>;

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

/**
 * HostVault.approve never emits an internal message, so a flat network-price
 * fee estimate is enough.
 */
async function writeWithFlatFees(
  client: WriteClient,
  address: string,
  functionName: string,
  kwargs: object,
): Promise<string> {
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

/**
 * Helix.ingest_threat conditionally emits an internal message to
 * HostVault.apply_mutation (and, on GROW_ORGAN, deploys + registers a
 * Watchdog). A flat fee estimate has no budget allocated for that internal
 * message and the write reverts with "fee no_matching_allocation # internal"
 * - confirmed live. estimateTransactionFeesForWrite runs a real simulation of
 * this exact call first, so its returned messageAllocations covers whatever
 * the leader's run actually triggers.
 */
async function writeWithSimulatedFees(
  client: WriteClient,
  address: string,
  functionName: string,
  kwargs: object,
): Promise<string> {
  const callArgs = { address: address as `0x${string}`, functionName, args: [], kwargs, value: 0n };
  const estimate = await client.estimateTransactionFeesForWrite(callArgs as never);
  const fees = {
    distribution: estimate.distribution,
    messageAllocations: estimate.messageAllocations,
    feeValue: estimate.feeValue,
  };
  const hash = await client.writeContract({ ...callArgs, fees } as never);
  return hash as unknown as string;
}

/** HostVault.approve(spender, amount). Reverts FROZEN_BY_HELIX once spliced. */
export async function approve(client: WriteClient, spender: string, amountWei: bigint): Promise<string> {
  return writeWithFlatFees(client, HOST_VAULT_ADDRESS, "approve", { spender, amount: amountWei });
}

/** Helix.ingest_threat(url_a, url_b) — runs the leader/validator consensus round. */
export async function ingestThreat(client: WriteClient, urlA: string, urlB: string): Promise<string> {
  return writeWithSimulatedFees(client, HELIX_ADDRESS, "ingest_threat", { url_a: urlA, url_b: urlB });
}

export type JuryTally = { agree: number; total: number };

/**
 * Waits for FINALIZED and throws unless the transaction actually succeeded.
 * Reaching FINALIZED only means consensus reached a terminal state - it does
 * NOT mean the write did anything. A validator disagreement (DISAGREE/
 * UNDETERMINED - no equivalence reached, nothing persisted) or a reverted
 * UserError (FINISHED_WITH_ERROR) both finalize cleanly with no thrown
 * exception from waitForFinalization itself. isSuccessful() is the same
 * genlayer-js helper scripts/deploy.ts uses to gate its own success claim -
 * checking only "did the promise resolve" here would let the UI declare
 * "finalized" on a call that changed nothing on-chain.
 *
 * studio-dev enforces a hard per-account RPC rate limit (500 req/hour,
 * confirmed empirically) and a tight poll interval burns through it fast -
 * a single finalization wait can otherwise cost dozens of requests on its
 * own, on top of whatever else is polling get_state/get_status in the
 * background. 10s keeps one write's wait under ~30 requests even in the
 * worst case (5 minutes to finalize).
 *
 * Returns the real on-chain jury tally read off the finalized receipt's
 * lastRound (how many of the round's validators actually voted AGREE), or
 * null when the receipt carries no round data to count - the Theater's dot
 * row uses this instead of a hardcoded number.
 */
export async function waitForTx(hash: string): Promise<JuryTally | null> {
  const client = await readClient();
  const receipt = await client.waitForFinalization({ hash, retries: 60, interval: 10000 } as never);
  const r = receipt as unknown as {
    status_name?: string;
    result_name?: string;
    lifecycle?: { state?: string; outcome?: string };
    lastRound?: { validatorVotesName?: string[] };
  };
  const finalized = r.lifecycle?.state === "finalized";
  if (!finalized || !isSuccessful(receipt as never)) {
    throw new Error(
      `Transaction did not finalize successfully: status=${r.status_name} result=${r.result_name} lifecycle=${JSON.stringify(r.lifecycle)}`,
    );
  }
  const votes = r.lastRound?.validatorVotesName;
  if (!votes || votes.length === 0) return null;
  const agree = votes.filter((v) => v === "AGREE" || v === "MAJORITY_AGREE").length;
  return { agree, total: votes.length };
}

/**
 * Turn a thrown wallet/VM error into the short line the theater shows.
 * A frozen vault surfaces as FROZEN_BY_HELIX, which is the whole point.
 */
export function readableError(err: unknown): string {
  // The specific, actionable text (e.g. "Rate limit exceeded: 500 requests
  // per hour") frequently lands in viem's nested `details`/`cause.message`
  // rather than `message`/`shortMessage` - those two alone showed only
  // "An unknown RPC error occurred." / "An internal error was received."
  // (MetaMask's own even-more-generic wrapping) for a confirmed-live
  // rate-limit failure, which is indistinguishable from any other failure
  // to a user. Checking every field a real error could carry the detail in
  // means one specific case can't hide behind whichever field happened to
  // be generic this time.
  const e = err as {
    shortMessage?: string;
    message?: string;
    details?: string;
    cause?: { message?: string; details?: string };
  };
  const raw =
    typeof err === "string"
      ? err
      : [e?.shortMessage, e?.message, e?.details, e?.cause?.message, e?.cause?.details]
          .filter(Boolean)
          .join(" | ") || String(err);
  if (raw.includes("FROZEN_BY_HELIX")) return "FROZEN_BY_HELIX";
  if (raw.includes("above max_approval")) return "above max_approval";
  if (raw.includes("evidence url")) return raw.match(/evidence url[^"\\]*/)?.[0] ?? raw;
  if (/user rejected|denied|4001/i.test(raw)) return "Signature rejected.";
  if (/rate limit exceeded/i.test(raw)) {
    return "Studio Devnet is rate-limited right now (500 requests/hour, network-wide). Wait a few minutes and try again.";
  }
  if (raw.includes("did not finalize successfully")) {
    if (/result=DISAGREE|status=UNDETERMINED/.test(raw)) {
      return "Validators disagreed - nothing was recorded. Try again.";
    }
    if (raw.includes("CANCELED")) return "Transaction expired before a validator picked it up. Try again.";
    return "Transaction finalized without succeeding.";
  }
  if (/unknown rpc error|internal error/i.test(raw)) {
    return "The network rejected the request without a specific reason - often the studio-dev rate limit. Wait a few minutes and try again.";
  }
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
}
