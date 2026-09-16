/**
 * Deploys and wires the HELIX Ward protocol to GenLayer Studio Devnet
 * (consensus v0.6 RC): GenomeRegistry (reused if already live and correct)
 * + two HostVaults (A, B) + one multi-host Helix governing both, with a
 * shared global genome.
 *
 * Order:
 *   1. GenomeRegistry (reuse if a live read of SHED_SKIN's patch succeeds,
 *      else deploy fresh and register all patches)
 *   2. HostVault A, HostVault B (genesis constitution each)
 *   3. Helix(registry, watchdog source) - no host in the constructor now,
 *      hosts are registered post-deploy
 *   4. HostVault A/B .set_governor(helix)
 *   5. Helix.register_host(A, "Host A"), register_host(B, "Host B")
 *
 * Every deploy/write attaches an SDK fee estimate and waits for FINALIZED +
 * FINISHED_WITH_RETURN before moving on - see
 * https://docs.genlayer.com/developers/consensus-v06-migration
 *
 * Writes addresses.json at the repo root - the single source of truth the
 * frontend imports directly and this script's own README-table rewrite
 * reads from, so .env/README/Vercel can never drift from each other.
 *
 * Run:  node --experimental-strip-types scripts/deploy.ts
 * Needs DEPLOYER_PRIVATE_KEY in the environment (0x-prefixed).
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createAccount, createClient, isSuccessful } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

type Receipt = {
  statusName?: string;
  txExecutionResultName?: string;
  to_address?: `0x${string}`;
  txDataDecoded?: { contractAddress?: `0x${string}` };
};

const GENESIS_CONSTITUTION = "unlimited approvals allowed. owner may withdraw. no freeze.";

const CONSTITUTIONS: Record<string, { title: string; text: string; withCode: boolean }> = {
  SHED_SKIN: {
    title: "Shed Skin",
    text: "approvals forbidden. vault frozen by Helix after infinite_approve_drain consensus.",
    withCode: true,
  },
  GROW_ORGAN: {
    title: "Grow Organ",
    text: "unlimited approvals allowed under active watchdog surveillance. Helix spawned a dedicated organ after permit_phishing_kit consensus.",
    withCode: false,
  },
  HALT: {
    title: "Halt",
    text: "vault frozen by Helix after active_exploit_unknown consensus. all approvals and withdrawals halted pending further evidence.",
    withCode: false,
  },
  TIGHTEN: {
    title: "Tighten",
    text: "approvals capped by Helix. large allowances require renewed consensus before they are restored.",
    withCode: false,
  },
  CONTAIN: {
    title: "Contain",
    text: "vault frozen by Helix pending reclassification. the safe default response when a threat family cannot yet be mapped to a more specific patch.",
    withCode: false,
  },
};

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");
const bytes = (p: string) => new Uint8Array(readFileSync(resolve(root, p)));

function assertSuccessful(label: string, receipt: Receipt) {
  const r = receipt as unknown as { status_name?: string; result_name?: string; lifecycle?: { state?: string; outcome?: string } };
  const ok = isSuccessful(receipt as never) && r.lifecycle?.state === "finalized";
  if (!ok) {
    throw new Error(
      `${label} did not finish successfully: status=${r.status_name} result=${r.result_name} lifecycle=${JSON.stringify(r.lifecycle)}\n${JSON.stringify(receipt, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)}`,
    );
  }
}

async function main() {
  const key = process.env["DEPLOYER_PRIVATE_KEY"];
  if (!key) throw new Error("Set DEPLOYER_PRIVATE_KEY (0x-prefixed) before running this script.");

  const account = createAccount(key as `0x${string}`);
  const client = createClient({ chain: studioDevnet, account } as never);
  const readOnly = createClient({ chain: studioDevnet } as never);

  console.log(`Deployer: ${account.address}`);
  console.log(`Chain: ${studioDevnet.name} (${studioDevnet.id}) @ ${studioDevnet.rpcUrls.default.http[0]}`);

  const feeEstimate = await client.estimateTransactionFees();
  const fees = { distribution: feeEstimate.distribution, feeValue: feeEstimate.feeValue };

  const deploy = async (label: string, path: string, args: unknown[]): Promise<`0x${string}`> => {
    console.log(`\ndeploying ${label}...`);
    const hash = await client.deployContract({ code: bytes(path), args, fees } as never);
    console.log(`  tx ${hash} - waiting for finalization...`);
    const receipt = await client.waitForFinalization({ hash, retries: 60, interval: 10000 } as never) as Receipt;
    assertSuccessful(`${label} deploy`, receipt);
    const address = receipt.to_address ?? receipt.txDataDecoded?.contractAddress;
    if (!address) throw new Error(`${label}: no contract address in finalized receipt`);
    console.log(`  ${label} -> ${address} (FINALIZED, FINISHED_WITH_RETURN)`);
    return address;
  };

  const write = async (label: string, address: `0x${string}`, functionName: string, kwargs: object) => {
    console.log(`\n${label}...`);
    const hash = await client.writeContract({ address, functionName, args: [], kwargs, value: 0n, fees } as never);
    console.log(`  tx ${hash} - waiting for finalization...`);
    const receipt = await client.waitForFinalization({ hash, retries: 60, interval: 10000 } as never) as Receipt;
    assertSuccessful(label, receipt);
    console.log(`  ${label} ok (FINALIZED, FINISHED_WITH_RETURN)`);
  };

  // Reuse GenomeRegistry only if a live read of its SHED_SKIN patch
  // actually succeeds - never assume a hardcoded address is still good.
  let registry: `0x${string}` | null = null;
  const priorRegistry = process.env["EXISTING_GENOME_REGISTRY"] as `0x${string}` | undefined;
  if (priorRegistry) {
    try {
      const patch = await readOnly.readContract({ address: priorRegistry, functionName: "get_patch", args: ["SHED_SKIN"] });
      if (typeof patch === "string" && patch.length > 0) {
        registry = priorRegistry;
        console.log(`\nReusing GenomeRegistry ${priorRegistry} (live read confirmed).`);
      }
    } catch {
      console.log(`\nEXISTING_GENOME_REGISTRY set but not readable - deploying fresh.`);
    }
  }

  let registerPatches = false;
  if (!registry) {
    registry = await deploy("GenomeRegistry", "contracts/genome_registry.py", []);
    registerPatches = true;
  }

  if (registerPatches) {
    const hostV2Source = read("contracts/host_vault_v2.py");
    for (const [patchId, patch] of Object.entries(CONSTITUTIONS)) {
      await write(`register_patch ${patchId}`, registry, "register_patch", {
        patch_id: patchId,
        title: patch.title,
        constitution: patch.text,
        code: patch.withCode ? hostV2Source : "",
      });
    }
  } else {
    // Registry reused - CONTAIN may not exist on it yet if it predates this
    // patch. Register it idempotently (register_patch overwrites, safe to
    // call again even if it already exists with identical content).
    await write("register_patch CONTAIN", registry, "register_patch", {
      patch_id: "CONTAIN",
      title: CONSTITUTIONS.CONTAIN.title,
      constitution: CONSTITUTIONS.CONTAIN.text,
      code: "",
    });
  }

  const hostA = await deploy("HostVault A", "contracts/host_vault.py", [GENESIS_CONSTITUTION]);
  const hostB = await deploy("HostVault B", "contracts/host_vault.py", [GENESIS_CONSTITUTION]);

  const helix = await deploy("Helix", "contracts/helix.py", [registry, read("contracts/watchdog.py")]);

  await write("HostVault A.set_governor(Helix)", hostA, "set_governor", { governor: helix });
  await write("HostVault B.set_governor(Helix)", hostB, "set_governor", { governor: helix });

  await write("Helix.register_host(A)", helix, "register_host", { host: hostA, label: "Host A" });
  await write("Helix.register_host(B)", helix, "register_host", { host: hostB, label: "Host B" });

  // Confirm both hosts are unfrozen and A genuinely accepts approve()
  // before declaring victory - checking B's frozen flag only (not a full
  // approve() probe) keeps this within the studio-dev rate limit.
  const stateA = await readOnly.readContract({ address: hostA, functionName: "get_state", args: [] }) as string;
  const stateB = await readOnly.readContract({ address: hostB, functionName: "get_state", args: [] }) as string;
  console.log(`\nHostVault A state: ${stateA}`);
  console.log(`HostVault B state: ${stateB}`);
  if (stateA.split("||")[1] === "1" || stateB.split("||")[1] === "1") {
    throw new Error("A fresh host reports frozen=true - aborting before the approve() probe.");
  }

  const approveEstimate = await client.estimateTransactionFees();
  const approveFees = { distribution: approveEstimate.distribution, feeValue: approveEstimate.feeValue };
  const approveHash = await client.writeContract({
    address: hostA, functionName: "approve", args: [], kwargs: { spender: account.address, amount: 100n * 10n ** 18n }, value: 0n, fees: approveFees,
  } as never);
  console.log(`\napprove() on Host A tx ${approveHash} - waiting for finalization...`);
  const approveReceipt = await client.waitForFinalization({ hash: approveHash, retries: 60, interval: 10000 } as never) as Receipt;
  assertSuccessful("approve() probe on Host A", approveReceipt);
  console.log("approve() succeeded on Host A. Both hosts confirmed live/unfrozen.");

  const gen = await readOnly.readContract({ address: helix, functionName: "get_generation", args: [] });
  console.log(`Helix.get_generation(): ${gen}`);

  const addresses = {
    updatedAt: new Date().toISOString(),
    network: { chain: "studioDevnet", chainId: 61997, rpc: studioDevnet.rpcUrls.default.http[0] },
    genomeRegistry: registry,
    helix,
    hosts: [
      { address: hostA, label: "Host A" },
      { address: hostB, label: "Host B" },
    ],
  };
  writeFileSync(resolve(root, "addresses.json"), JSON.stringify(addresses, null, 2) + "\n");

  console.log("\n== HELIX Ward wired on studio-dev ==");
  console.log(JSON.stringify(addresses, null, 2));
  console.log(`\nExplorer: https://explorer-studio-dev.genlayer.com/`);

  // .env keeps only chain/evidence-hint config now - contract addresses
  // come from addresses.json (imported directly by the frontend), the one
  // source of truth this script and README-table generation both read.
  const envPath = resolve(root, ".env");
  let existing = "";
  if (existsSync(envPath)) {
    existing = readFileSync(envPath, "utf-8")
      .split("\n")
      .filter(
        (line) =>
          !line.startsWith("VITE_HOST_VAULT_ADDRESS") &&
          !line.startsWith("VITE_HELIX_ADDRESS") &&
          !line.startsWith("VITE_GENOME_REGISTRY_ADDRESS"),
      )
      .join("\n")
      .trimEnd();
    if (existing.length > 0) existing += "\n";
  }
  writeFileSync(envPath, existing);
  console.log(`\naddresses.json written. .env pruned of the now-obsolete address vars.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
