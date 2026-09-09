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
upgrade primitive (`root.code.get().truncate()` / `.extend()`). Writes to that slot
are platform-gated: GenVM raises a `VMError` for any sender not in the contract's
`upgraders` list, per the official upgradability docs. `Helix` is added to that list
by the same `set_governor` call that grants it write access.

`HostVault` also exposes a standalone `upgrade(new_code)` write method (independent
of `apply_mutation`'s own inline splice). Because `set_governor` only ever *appends*
to `upgraders` and never removes the original deployer, the deployer EOA stays on
that list permanently — the platform-level check alone would let the deployer call
`upgrade()` directly and rewrite the vault's code with no consensus round, which
directly contradicts the "no human, no council" trust model above. `upgrade()` is
now also gated `governor`-only at the application level (same precondition
`apply_mutation` uses), so in practice only `Helix` — i.e. only a finalized consensus
decision — can reach `root.code`, regardless of who GenVM's own `upgraders` list
still contains.

## Known trade-offs

- `HostVault.withdraw` is owner-only with no per-depositor accounting — `deposit()` is
  a plain payable sink. This is an owner-controlled-treasury pattern, not an
  escrow/vault holding third-party claims, so there is no "staked funds stuck forever"
  liveness concern: nothing is pending resolution, and a freeze is the intended
  security response, not an accidental lock.
- `Helix.ingest_threat`'s cross-contract writes to `HostVault`
  (`host.emit(on="decided").apply_mutation(...)`) are asynchronous by GenVM design —
  a mutation lands as a separate, independently-consensus-reached child transaction
  after `ingest_threat`'s own transaction is accepted. The UI reflects this by polling
  `HostVault.get_state()` rather than assuming the mutation applied the instant
  `ingest_threat` is accepted.
- `HostVault.approve`/`allowances` model the ERC20-style "unlimited approval" surface
  the threat narrative reacts to, but this contract never implements a
  `transferFrom`-style consumer of that allowance — there is no on-chain drain path to
  demonstrate against. HELIX reacts to *evidence* that this threat class exists (an
  advisory URL), the same way a real deployed DeFi vault would react to a live
  disclosure about itself; it does not stage the exploit on-chain.
- `HostVault.withdraw(to, amount)` sends value to any address with no check that `to`
  is a human EOA rather than another contract. GenVM has no on-chain primitive to
  distinguish the two, and a value-only `emit_transfer` to another Intelligent
  Contract is known to fail silently with no rescue path — see the platform
  limitations below. `withdraw` is owner-only, so this risk is scoped to the owner's
  own input, not a caller-supplied attack surface.

## Operational risk: studio-dev's RPC rate limit

GenLayer Studio Devnet enforces a hard rate limit on `eth_sendRawTransaction`
(confirmed empirically during this project's own deploy/verification work:
`Rate limit exceeded: 500 requests per hour`). It does not appear to be a simple
sliding window — it stayed in effect well past the point a rolling-window model
would predict recovery. `waitForFinalization`'s own polling loop is the likely
dominant cost (each in-flight write can cost dozens of polls on its own, on top of
whatever else is reading live state in the background), so both the deploy script
and the frontend now poll conservatively (10s for finalization waits, 20s for the
Theater/Dossier's live state poll — see `src/lib/helix-contracts.ts` and
`src/lib/helix-state.tsx`). If this project is judged live rather than from a
recording, avoid stacking multiple write flows (deploy + demo + a judge's own
`Approve`/`Ingest threat` clicks) in a short window against the same account.

## Studio-dev is a release candidate, not a stable network

Per GenLayer's own migration docs: "Studio-dev is a release-candidate environment
and may reset." If it resets, the three addresses in `README.md`/`SUBMISSION.md`
go dead with no code change required to fix — just `npm run deploy:helix` again
and update `.env` / the Vercel project's env vars.

Report issues by opening a GitHub issue on this repo.
