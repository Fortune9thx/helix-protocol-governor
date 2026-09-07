# Security

## Trust model

`HostVault`'s only privileged actor is `governor`, an `Address` set once at wire time to
`Helix`'s own contract address via `set_governor`. `apply_mutation` and `register_organ`
are governor-only; `Helix` is the only account ever set as governor in the deploy
script. There is no multisig, admin key, or pause mechanism outside the contracts
themselves — freezing the vault is a consequence of validator consensus, not a
privileged human action.

`Helix`'s equivalence check is on `should_act` + `threat_family` + `patch_id` only. The
validator independently re-fetches the same evidence and re-runs the leader function
from scratch rather than checking the leader's claimed output shape — see
`validator_fn` in `contracts/helix.py`.

## Evidence URL validation

Every validator independently fetches the two evidence URLs a caller passes to
`ingest_threat`. Without validation this is a real SSRF surface: a caller could point a
URL at `localhost`, a private/loopback/link-local IP, or a cloud metadata endpoint
(`169.254.169.254`), and every validator's own infrastructure would try to reach it.
`_validate_evidence_url` in `contracts/helix.py` rejects non-`http(s)` schemes, missing
hosts, embedded credentials, `localhost`/`*.localhost`, and IP-literal hosts (dotted or
decimal-encoded) that are private, loopback, link-local, reserved, multicast, or
unspecified — before the URL ever reaches `gl.nondet.web.*`. Covered by
`tests/direct/test_helix_ssrf.py` (11 blocked cases, 1 confirmed-passing legitimate
URL).

## Native code upgrade

`SHED_SKIN` replaces `HostVault`'s running source via GenVM's native `root.code`
upgrade primitive (`root.code.get().truncate()` / `.extend()`), gated on the caller
being in the vault's `upgraders` list — `Helix` is added to that list by the same
`set_governor` call that grants it write access, so only `Helix` (i.e. only a
consensus-reached decision) can ever trigger the splice.

## Known trade-offs

- `HostVault.withdraw` is owner-only with no per-depositor accounting — `deposit()` is
  a plain payable sink. This is an owner-controlled-treasury pattern, not an
  escrow/vault holding third-party claims, so there is no "staked funds stuck forever"
  liveness concern: nothing is pending resolution, and a freeze is the intended
  security response, not an accidental lock.
- `Helix.ingest_threat`'s cross-contract writes to `HostVault`
  (`host.emit(on="accepted").apply_mutation(...)`) are asynchronous by GenVM design —
  a mutation lands as a separate, independently-consensus-reached child transaction
  after `ingest_threat`'s own transaction is accepted. The UI reflects this by polling
  `HostVault.get_state()` rather than assuming the mutation applied the instant
  `ingest_threat` is accepted.

Report issues by opening a GitHub issue on this repo.
