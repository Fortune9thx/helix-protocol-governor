# SUBMISSION

**Name:** HELIX

**Track:** Autonomous Protocols

**Line:** The first Intelligent Contract that governs a fleet of other contracts' code
— and writes what it learned into its own law, so it never panics at the same threat
twice, on any host it governs. No Safe. No council. The web is the signal. Consensus is
the surgeon.

**Live app:** https://helix-protocol-governor.vercel.app
**Repo:** https://github.com/Fortune9thx/helix-protocol-governor
**Network:** GenLayer Studio Devnet (consensus v0.6 RC, chain 61997) — explorer at
https://explorer-studio-dev.genlayer.com/

| Contract | Address |
|---|---|
| GenomeRegistry | `0x8917000947c06B57CDbc10d79f544445c096913d` |
| Helix | `0x389e4f2B60f451BF6aa70291EB76e551Cc396A71` |
| HostVault (Host A) | `0x01a4295Bd14376efb7e75274497B4918051411B0` |
| HostVault (Host B) | `0x3dDA908ee7d249695a999D8FC4E4E84b80ad8645` |

## What it is

HELIX is a Ward Intelligent Contract (`contracts/helix.py`) that governs a set of
registered `HostVault`s (`contracts/host_vault.py`). Anyone can `register_host` a vault
that has already set its `governor` to Helix — no human, no multisig, no admin council
in the mutation path itself.

`raise_alarm(host, threat_url, evidence_url)` is payable: the filer posts a GEN bond,
Helix fetches page text (and, when available, a screenshot) of the two URLs directly
inside the contract via `gl.nondet.web.render` and `gl.nondet.exec_prompt`, then runs
`gl.vm.run_nondet(leader_fn, validator_fn)` — `validator_fn` doesn't check the leader's
output shape, it independently re-fetches the same evidence and re-derives the answer
from scratch, per GenLayer's own recommended "custom validator" pattern for
consequential decisions. Equivalence is checked on `should_act` + `threat_family` +
`patch_id` only — never on the free-text rationale, and never `strict_eq` on an LLM
string.

Once consensus lands on a `threat_family`, it maps deterministically to a `patch_id`
and HELIX cross-contract-calls that specific host's `apply_mutation`:

- `infinite_approve_drain → SHED_SKIN` — freezes the vault, rewrites its constitution,
  and replaces its own running Python source (`contracts/host_vault_v2.py`) via GenVM's
  native `root.code` upgrade mechanism, live, from inside the write path that decided
  it was necessary.
- `permit_phishing_kit → GROW_ORGAN` — deploys a fresh `Watchdog` child contract with
  `gl.contract.deploy` and registers it on the host. `Watchdog` is a receipt contract,
  not an active organ: permanent on-chain proof of which family triggered which
  mutation on which host, not a standalone monitor. See SECURITY.md.
- `active_exploit_unknown → CONTAIN` — freezes without a code splice, the safe default
  for a family that can't yet be mapped to something more specific.
- `noise → NONE` — no mutation, and the bond is slashed to Helix's treasury: a false
  alarm has a real cost.

A frozen `HostVault.approve` reverts `FROZEN_BY_HELIX`. A correct alarm (new or already
law) gets its bond refunded.

## The genome — global, not per-host

Every consensus-reached mutation also appends one clause to an on-chain, append-only
genome (`Helix.genome`/`get_genome()`) shared across *every* host Helix governs — a
permanent, growing record of every law Helix has ever written, not just one vault's
current state. Alarming the same threat family against a *second* host does not write a
duplicate clause: `has_clause(family)` short-circuits to `already_expressed=true` before
any second clause is written, even though that second host's own `apply_mutation` still
runs — the law was already settled, only the enforcement is per-host. There is no update
or delete method on the genome anywhere in the contract; the only way a clause's fields
ever change is a full redeploy.

## Why GenLayer

This isn't a thin LLM wrapper around a boolean posted to a normal EVM contract. It's
screenshot-plus-HTML evidence fetched inside the contract, multi-model equivalence on a
structured threat classification with an independently-re-deriving validator (not a
format-only shape check), and a real `emit()` / native code `upgrade()` /
`deploy_contract()` state transition across a whole fleet of governed contracts — the
kind of decision an EVM oracle can't make because there's no way to have five
independent models read a security advisory and agree on what it means without a chain
that natively supports non-determinism plus consensus.

## No Safe, no council — what that actually means

Each `HostVault`'s only privileged actor is `governor`, initialized to the deployer
(`owner`) at genesis and handed off to `Helix`'s own contract address once via
`set_governor`. That method is governor-only, not owner-or-governor: `owner`'s
first call succeeds only because `owner == governor` at genesis, and the instant
governance moves to Helix, `owner` has no standing right left to reclaim, redirect, or
rotate it again — only whoever currently holds `governor` can hand it off further. A
human can still call `approve`/`withdraw` on an unfrozen vault (it's still their vault
and their funds), but after `register_host`, the *only* way that vault ever gets
frozen, re-constituted, or spliced is independent validators agreeing, from public
evidence, that it should be — for that specific host, driven by one shared, permanent
record of every threat family Helix has ever ruled on. Ethereum's answer to "the vault
is under active attack" is a human racing to click "pause" in a Safe UI before the
drain finishes. HELIX's answer is a governor contract that already read the advisory,
already voted, and will never have to re-litigate the same threat family again on any
vault it watches.

## What's hardened, not just working

- `raise_alarm` refuses evidence URLs that resolve to localhost, private/loopback/
  link-local IPs (including decimal-encoded and IPv6 forms), or carry embedded
  credentials, before either URL ever reaches `gl.nondet.web.*` — every validator
  fetches it independently, so an unvalidated caller-supplied URL is a real SSRF
  surface. Covered by `tests/direct/test_helix_ssrf.py`.
- All 5 contracts pass `genvm-lint check` clean (static checks + full validation).
- `register_host` is gated on the target already reporting `get_governor() == this
  Helix` — a host can't be registered by anyone but whoever already controls it.
- Direct-mode tests cover: family→patch mapping, host registration, the
  already_expressed idempotency path across two hosts sharing one genome, false-alarm
  bond slashing, unregistered-host rejection, HostVault's freeze/version/constitution
  state machine, GenomeRegistry's patch CRUD + access control, and the SSRF suite.
  Currently unrunnable locally due to a disclosed upstream `gltest` tooling gap (see
  README) — logic verified by lint + live network testing instead.
- The full loop has been verified live on Studio Devnet, not just in direct-mode tests:
  two hosts registered, `approve()` confirmed working on a fresh unfrozen host, and an
  earlier deploy's real alarm against the drain-advisory evidence URL fetched the page,
  classified it `infinite_approve_drain` at 93% confidence, reached
  `MAJORITY_AGREE`/`FINALIZED` validator consensus, and cross-contract-called
  `HostVault.apply_mutation` — genome version bumped, `frozen` flipped, the constitution
  was rewritten, and a subsequent `approve()` genuinely reverted `FROZEN_BY_HELIX`.

## UI

The Theater / Dossier / Log interface is the existing AgenticX-derived design (see
`AGENTS.md`), wired to real reads/writes rather than restyled: `Connect` is a real
wallet connection (RainbowKit), a host switcher on Theater/Dossier selects which
registered `HostVault` you're acting on, `Approve 100 ETH` is a real
`HostVault.approve` call that reverts `FROZEN_BY_HELIX` once that host is spliced, and
`Raise alarm` is a real `Helix.raise_alarm` call whose Dossier verdict dump — including
an honest `ALREADY LAW` state when the family is already settled — is read back from
on-chain state, never fabricated in the browser. There is no local "fake it" toggle
anywhere in the production UI.
