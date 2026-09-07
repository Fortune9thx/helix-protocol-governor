# SUBMISSION

**Name:** HELIX

**Track:** Autonomous Protocols

**Line:** The first Intelligent Contract that governs another contract's code. No
Safe. No council. The web is the signal. Consensus is the surgeon.

**Live app:** https://helix-protocol-governor.lovable.app
**Repo:** https://github.com/Fortune9thx/helix-protocol-governor

## What it is

HELIX is a governor Intelligent Contract (`contracts/helix.py`) that reads live public
web evidence, reaches multi-validator equivalence on a threat classification, and then
mutates a second contract it governs — `HostVault` (`contracts/host_vault.py`) — with
no human, no multisig, no admin council anywhere in the loop.

`Helix.ingest_threat(url_a, url_b)` fetches page text (and, when available, a
screenshot) of two evidence URLs directly inside the contract via `gl.nondet.web.render`
and `gl.nondet.exec_prompt`, then runs `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`
— `validator_fn` doesn't check the leader's output shape, it independently re-fetches
the same evidence and re-derives the answer from scratch, per GenLayer's own
recommended "custom validator" pattern for consequential decisions. Equivalence is
checked on `should_act` + `threat_family` + `patch_id` only — never on the free-text
rationale, and never `strict_eq` on an LLM string.

Once consensus lands on a `threat_family`, it maps deterministically to a `patch_id`
and HELIX cross-contract-calls `HostVault.apply_mutation`:

- `infinite_approve_drain → SHED_SKIN` — freezes the vault, rewrites its constitution,
  and replaces its own running Python source (`contracts/host_vault_v2.py`) via GenVM's
  native `root.code` upgrade mechanism, live, from inside the write path that decided
  it was necessary.
- `permit_phishing_kit → GROW_ORGAN` — deploys a fresh `Watchdog` child contract with
  `gl.deploy_contract` and registers it on the host.
- `active_exploit_unknown → HALT` — freezes without a code splice.
- `noise → NONE` — no mutation.

A frozen `HostVault.approve` reverts `FROZEN_BY_HELIX`.

## Why GenLayer

This isn't a thin LLM wrapper around a boolean posted to a normal EVM contract. It's
screenshot-plus-HTML evidence fetched inside the contract, multi-model equivalence on a
structured threat classification with an independently-re-deriving validator (not a
format-only shape check), and a real `emit()` / native code `upgrade()` /
`deploy_contract()` state transition — the kind of decision an EVM oracle can't make
because there's no way to have five independent models read a security advisory and
agree on what it means without a chain that natively supports non-determinism plus
consensus.

## No Safe, no council — what that actually means

`HostVault`'s only privileged actor is `governor`, set once at wire time to `Helix`'s
own contract address. A human can still call `approve`/`withdraw` on the unfrozen
vault, but the *only* way the vault ever gets frozen, re-constituted, or spliced is
independent validators agreeing, from public evidence, that it should be. Ethereum's
answer to "the vault is under active attack" is a human racing to click "pause" in a
Safe UI before the drain finishes. HELIX's answer is a governor contract that already
read the advisory and already voted.

## What's hardened, not just working

- `ingest_threat` refuses evidence URLs that resolve to localhost, private/loopback/
  link-local IPs (including decimal-encoded and IPv6 forms), or carry embedded
  credentials, before the URL ever reaches `gl.nondet.web.*` — every validator fetches
  it independently, so an unvalidated caller-supplied URL is a real SSRF surface.
  Covered by 11 parametrized direct-mode tests (`tests/direct/test_helix_ssrf.py`).
- All 5 contracts pass `genvm-lint check` clean.
- 25 direct-mode tests: family→patch mapping (drain advisory → `SHED_SKIN`, phishing
  kit → `GROW_ORGAN`, unrelated page → `NONE`), a validator-equivalence test proving
  the validator independently re-derives rather than shape-checks, HostVault's full
  freeze/version/constitution state machine, GenomeRegistry's patch CRUD + access
  control, and the SSRF suite above.
- CI (`.github/workflows/ci.yml`) actually runs `genvm-lint` + `pytest` + a frontend
  typecheck on every push, not just locally.

## UI

The Theater / Dossier / Log interface is the existing AgenticX-derived design (see
`AGENTS.md`), wired to real reads/writes rather than restyled: `Connect` is a real
MetaMask connection, `Approve 100 ETH` is a real `HostVault.approve` call that reverts
`FROZEN_BY_HELIX` once the vault is spliced, and `Ingest threat` is a real
`Helix.ingest_threat` call whose Dossier verdict dump is read back from on-chain state,
never fabricated in the browser.
