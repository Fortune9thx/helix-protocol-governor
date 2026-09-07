/**
 * Deploys and wires the HELIX protocol to GenLayer Studio Devnet
 * (consensus v0.6 RC), then prints the addresses to paste into .env.
 *
 * Order:
 *   1. GenomeRegistry
 *   2. HostVault(genesis constitution)
 *   3. register SHED_SKIN (carrying host_vault_v2.py source) + GROW_ORGAN / HALT / TIGHTEN
 *   4. Helix(host, registry, watchdog source)
 *   5. HostVault.set_governor(helix)  <- also adds Helix to the vault's upgraders
 *
 * Every deploy/write attaches an SDK fee estimate (studio-dev is a
 * fee-funded v0.6 network, not the old gasless Studio) and waits for
 * FINALIZED + FINISHED_WITH_RETURN before moving on - see
 * https://docs.genlayer.com/developers/consensus-v06-migration
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
};

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");
const bytes = (p: string) => new Uint8Array(readFileSync(resolve(root, p)));

function assertSuccessful(label: string, receipt: Receipt) {
  // isSuccessful() is the SDK's own helper - genlayer-js@2.0.0-rc.1's
  // waitForFinalization() returns a receipt shape whose status/result fields
  // are snake_case (status_name/result_name), not the camelCase
  // statusName/txExecutionResultName the GenLayerTransaction type promises,
  // so isSuccessful() (which reads the right fields internally) is the
  // reliable check here - confirmed against a real FINALIZED/MAJORITY_AGREE
  // deploy that a naive camelCase check misidentified as failed.
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

  console.log(`Deployer: ${account.address}`);
  console.log(`Chain: ${studioDevnet.name} (${studioDevnet.id}) @ ${studioDevnet.rpcUrls.default.http[0]}`);

  const feeEstimate = await client.estimateTransactionFees();
  console.log(`Fee estimate: feeValue=${feeEstimate.feeValue} distribution=${JSON.stringify(feeEstimate.distribution, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`);
  const fees = { distribution: feeEstimate.distribution, feeValue: feeEstimate.feeValue };

  const deploy = async (label: string, path: string, args: unknown[]): Promise<`0x${string}`> => {
    console.log(`\ndeploying ${label}...`);
    const hash = await client.deployContract({ code: bytes(path), args, fees } as never);
    console.log(`  tx ${hash} - waiting for finalization...`);
    const receipt = await client.waitForFinalization({ hash, retries: 200, interval: 3000 } as never) as Receipt;
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
    const receipt = await client.waitForFinalization({ hash, retries: 200, interval: 3000 } as never) as Receipt;
    assertSuccessful(label, receipt);
    console.log(`  ${label} ok (FINALIZED, FINISHED_WITH_RETURN)`);
  };

  const registry = await deploy("GenomeRegistry", "contracts/genome_registry.py", []);
  const host = await deploy("HostVault", "contracts/host_vault.py", [GENESIS_CONSTITUTION]);

  const hostV2Source = read("contracts/host_vault_v2.py");
  for (const [patchId, patch] of Object.entries(CONSTITUTIONS)) {
    await write(`register_patch ${patchId}`, registry, "register_patch", {
      patch_id: patchId,
      title: patch.title,
      constitution: patch.text,
      code: patch.withCode ? hostV2Source : "",
    });
  }

  const helix = await deploy("Helix", "contracts/helix.py", [
    host,
    registry,
    read("contracts/watchdog.py"),
  ]);

  await write("HostVault.set_governor(Helix)", host, "set_governor", { governor: helix });

  console.log("\n== HELIX wired on studio-dev ==");
  console.log(`GenomeRegistry: ${registry}`);
  console.log(`HostVault:      ${host}`);
  console.log(`Helix:          ${helix}`);
  console.log(`Explorer:       https://explorer-studio-dev.genlayer.com/`);

  const envLines = [
    `VITE_GENLAYER_CHAIN=studioDevnet`,
    `VITE_HOST_VAULT_ADDRESS=${host}`,
    `VITE_HELIX_ADDRESS=${helix}`,
    `VITE_GENOME_REGISTRY_ADDRESS=${registry}`,
    "",
  ].join("\n");

  const envPath = resolve(root, ".env");
  let existing = "";
  if (existsSync(envPath)) {
    existing = readFileSync(envPath, "utf-8")
      .split("\n")
      .filter(
        (line) =>
          !line.startsWith("VITE_GENLAYER_CHAIN") &&
          !line.startsWith("VITE_HOST_VAULT_ADDRESS") &&
          !line.startsWith("VITE_HELIX_ADDRESS") &&
          !line.startsWith("VITE_GENOME_REGISTRY_ADDRESS"),
      )
      .join("\n")
      .trimEnd();
    if (existing.length > 0) existing += "\n";
  }
  writeFileSync(envPath, existing + envLines);
  console.log(`\nAddresses written to ${envPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
