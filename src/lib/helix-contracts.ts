/**
 * Typed reads/writes against the deployed HELIX Ward contracts.
 *
 * HostVault.get_state() -> "version||frozen||max_approval||constitution||patch||family||mutation||organ_count"
 * Helix.get_status()    -> "alarm_count||host_count||organ||generation||treasury"
 *
 * studio-dev (consensus v0.6 RC) is fee-funded: every deploy/write must
 * carry an SDK fee estimate, and success is only proven once a transaction
 * is FINALIZED with FINISHED_WITH_RETURN - see
 * https://docs.genlayer.com/developers/consensus-v06-migration
 */

import { HELIX_ADDRESS, readClient } from "./genlayer";
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
  alarmCount: string;
  hostCount: string;
  lastOrgan: string;
  generation: string;
  treasury: string;
};

export type GenomeClause = {
  clauseId: string;
  family: string;
  patchId: string;
  sourceUrl: string;
  writtenGen: string;
  text: string;
  expressed: boolean;
};

export type Alarm = {
  alarmId: string;
  filer: string;
  host: string;
  threatUrl: string;
  evidenceUrl: string;
  family: string;
  patchId: string;
  shouldAct: boolean;
  alreadyExpressed: boolean;
  status: "acted" | "already_expressed" | "slashed" | string;
  bond: string;
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
    alarmCount: p[0] ?? "0",
    hostCount: p[1] ?? "0",
    lastOrgan: p[2] ?? "",
    generation: p[3] ?? "0",
    treasury: p[4] ?? "0",
  };
}

/** get_genome()'s wire format: one clause per line, fields joined by ||. */
export function parseGenome(raw: string): GenomeClause[] {
  if (!raw) return [];
  return raw.split("\n").map((line) => {
    const p = line.split("||");
    return {
      clauseId: p[0] ?? "",
      family: p[1] ?? "",
      patchId: p[2] ?? "",
      sourceUrl: p[3] ?? "",
      writtenGen: p[4] ?? "",
      text: p[5] ?? "",
      expressed: p[6] === "true",
    };
  });
}

function parseAlarm(raw: string): Alarm | null {
  if (!raw) return null;
  const p = raw.split("||");
  return {
    alarmId: p[0] ?? "",
    filer: p[1] ?? "",
    host: p[2] ?? "",
    threatUrl: p[3] ?? "",
    evidenceUrl: p[4] ?? "",
    family: p[5] ?? "",
    patchId: p[6] ?? "",
    shouldAct: p[7] === "true",
    alreadyExpressed: p[8] === "true",
    status: (p[9] as Alarm["status"]) ?? "",
    bond: p[10] ?? "0",
  };
}

export async function readHostState(hostAddress: string): Promise<HostState> {
  const client = await readClient();
  const raw = (await client.readContract({
    address: hostAddress as `0x${string}`,
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

/** Log's genome rows - real on-chain clauses, oldest first. Empty array = honest empty state. */
export async function readGenome(): Promise<GenomeClause[]> {
  const client = await readClient();
  const raw = (await client.readContract({
    address: HELIX_ADDRESS as `0x${string}`,
    functionName: "get_genome",
    args: [],
  })) as string;
  return parseGenome(raw);
}

/** Recent alarms, newest first, capped so a long history doesn't mean N sequential reads on every page load. */
export async function readRecentAlarms(limit = 10): Promise<Alarm[]> {
  const client = await readClient();
  const countRaw = (await client.readContract({
    address: HELIX_ADDRESS as `0x${string}`,
    functionName: "get_alarm_count",
    args: [],
  })) as string | number | bigint;
  const count = Number(countRaw);
  if (!count) return [];
  const start = Math.max(1, count - limit + 1);
  const ids = Array.from({ length: count - start + 1 }, (_, i) => count - i);
  const rows = await Promise.all(
    ids.map((id) =>
      client
        .readContract({ address: HELIX_ADDRESS as `0x${string}`, functionName: "get_alarm", args: [String(id)] })
        .then((raw) => parseAlarm(raw as string))
        .catch(() => null),
    ),
  );
  return rows.filter((a): a is Alarm => a !== null);
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
  value: bigint = 0n,
): Promise<string> {
  const estimate = await client.estimateTransactionFees();
  const fees = { distribution: estimate.distribution, feeValue: estimate.feeValue };
  const hash = await client.writeContract({
    address: address as `0x${string}`,
    functionName,
    args: [],
    kwargs,
    value,
    fees,
  } as never);
  return hash as unknown as string;
}

/**
 * raise_alarm conditionally emits an internal message to HostVault.
 * apply_mutation (and, on GROW_ORGAN, deploys + registers a Watchdog), and
 * on a correct alarm also emits a value-transfer refund - none of that has
 * a fixed budget a flat estimate could cover. estimateTransactionFeesForWrite
 * runs a real simulation of this exact call first, so its returned
 * messageAllocations covers whatever the leader's run actually triggers.
 */
async function writeWithSimulatedFees(
  client: WriteClient,
  address: string,
  functionName: string,
  kwargs: object,
  value: bigint = 0n,
): Promise<string> {
  const callArgs = { address: address as `0x${string}`, functionName, args: [], kwargs, value };
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
export async function approve(client: WriteClient, hostAddress: string, spender: string, amountWei: bigint): Promise<string> {
  return writeWithFlatFees(client, hostAddress, "approve", { spender, amount: amountWei });
}

/** Helix.raise_alarm(host, threat_url, evidence_url) - payable, bond in GEN wei. */
export async function raiseAlarm(
  client: WriteClient,
  hostAddress: string,
  threatUrl: string,
  evidenceUrl: string,
  bondWei: bigint,
): Promise<string> {
  return writeWithSimulatedFees(
    client,
    HELIX_ADDRESS,
    "raise_alarm",
    { host: hostAddress, threat_url: threatUrl, evidence_url: evidenceUrl },
    bondWei,
  );
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
 * own, on top of whatever else is polling live state in the background.
 * 10s keeps one write's wait under ~30 requests even in the worst case
 * (5 minutes to finalize).
 *
 * Returns the real on-chain jury tally read off the finalized receipt's
 * lastRound (how many of the round's validators actually voted AGREE), or
 * null when the receipt carries no round data to count.
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
  if (raw.includes("bond below MIN_BOND")) return "Bond too small - raise the amount and try again.";
  if (raw.includes("host not registered")) return "That host isn't registered with this Helix.";
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
