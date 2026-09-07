/**
 * Deploys and wires the HELIX protocol, then prints the three addresses to
 * paste into .env.
 *
 * Order matters:
 *   1. GenomeRegistry
 *   2. HostVault(genesis constitution)
 *   3. register SHED_SKIN (carrying host_vault_v2.py source) + GROW_ORGAN / HALT / TIGHTEN
 *   4. Helix(host, registry, watchdog source)
 *   5. HostVault.set_governor(helix)  <- also adds Helix to the vault's upgraders
 *
 * Run:  DEPLOYER_PRIVATE_KEY=0x... npm run deploy:helix
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAccount, createClient } from "genlayer-js";
import { studionet, testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

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

async function main() {
  const key = process.env["DEPLOYER_PRIVATE_KEY"];
  if (!key) throw new Error("Set DEPLOYER_PRIVATE_KEY (0x-prefixed) before running this script.");

  const chain =
    (process.env["VITE_GENLAYER_CHAIN"] ?? "testnetBradbury") === "studionet"
      ? studionet
      : testnetBradbury;

  const account = createAccount(key as `0x${string}`);
  const client = createClient({ chain, account } as never);
  await client.initializeConsensusSmartContract?.();

  const settle = async (hash: unknown, label: string) => {
    const receipt = await client.waitForTransactionReceipt({
      hash: hash as never,
      status: TransactionStatus.ACCEPTED,
      retries: 200,
    } as never);
    const name = (receipt as { statusName?: string }).statusName;
    if (name !== "ACCEPTED" && name !== "FINALIZED") {
      throw new Error(`${label} failed: ${JSON.stringify(receipt)}`);
    }
    return receipt as Record<string, any>;
  };

  const deploy = async (label: string, path: string, args: unknown[]) => {
    console.log(`deploying ${label}…`);
    const hash = await client.deployContract({ code: bytes(path), args } as never);
    const receipt = await settle(hash, `${label} deploy`);
    const address =
      receipt["txDataDecoded"]?.contractAddress ?? receipt["data"]?.contract_address;
    if (!address) throw new Error(`${label}: no contract address in receipt`);
    console.log(`  ${label} -> ${address}`);
    return address as `0x${string}`;
  };

  const write = async (label: string, address: string, functionName: string, kwargs: object) => {
    const hash = await client.writeContract({
      address: address as `0x${string}`,
      functionName,
      args: [],
      kwargs,
      value: 0n,
    } as never);
    await settle(hash, label);
    console.log(`  ${label} ok`);
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

  console.log("\nPaste into .env:\n");
  console.log(`VITE_HOST_VAULT_ADDRESS=${host}`);
  console.log(`VITE_HELIX_ADDRESS=${helix}`);
  console.log(`VITE_GENOME_REGISTRY_ADDRESS=${registry}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
