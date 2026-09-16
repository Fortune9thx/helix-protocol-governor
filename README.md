# Helix Core

Rebuild HELIX using ONLY the attached AgenticX screenshots as the design system.

Copy from the attachments:
- sand / cream / charcoal split
- giant tight black grotesque headlines
- small body text under a 1px rule
- pill-shaped floating top nav
- pill buttons
- dithered, pixel, barcode, slit-scan artwork (the face, the bars, the horse, the flower)
- numbered 01 02 03 04 frames
- generous whitespace
- no concrete photo, no lime, no blood red, no Times serif, no brutalist hairline theater

Do NOT copy AgenticX product copy. This app is HELIX, a live vault governor.

ONE app, THREE views, same visual identity. No Pricing About Contact footer.

PILL NAV
Theater    Dossier    Log
right: Connect

VIEW 1 THEATER (default, 1440x900, no scroll)
Left half sand (#E8E0D4):
  HELIX  as huge as AgenticX
  one line: Autonomous protocol. Genome governor.
  1px rule
  pill button: Approve 100 ETH
  under button: HostVault V1 · Unlimited approvals allowed.

Right half charcoal:
  a dithered / pixel portrait or barcode figure like the attached head
  overlay mono: PATIENT LIVE
  4 of 5 equivalent marks as 4 lit dots + 1 mute, like their slider dots

VIEW 2 DOSSIER
Cream page.
Headline: Dossier
Short line: Evidence the jury fetched.
Full-width barcode/dither artwork panel like Workflow Engine.
Two text fields (threat URL, evidence URL).
Pill: Ingest threat
Mono dump: should_act / family / patch

VIEW 3 LOG
Cream page.
Headline: Genome
Four frames exactly in the Core Capabilities layout:
  01 V1 live
  02 Ingest
  03 Jury 4/5
  04 V2 spliced
Each frame uses dithered stills in the attached style. No marketing adjectives.

STATE
A control "Spliced preview" flips Theater:
  Approve label → Frozen by Helix
  PATIENT LIVE → PATIENT DEAD
  V1 → V2
Same colors. No modal.

Forbidden: Get Started, Pricing, Capabilities essays, Inter as display if you can load a tighter grotesque, purple, crypto gradients, 3D DNA.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://helix-protocol-governor.vercel.app (deployed via Vercel, not
Lovable's own hosting — the `lovable.app` domain reflects the same code but not the
production contract addresses, so it will not show live chain data)

See [SUBMISSION.md](SUBMISSION.md) for the pitch, [DEMO.md](DEMO.md) for the demo
script, and [SECURITY.md](SECURITY.md) for the trust model.

## The GenLayer protocol

```
  ┌──────────────────┐        reads patches         ┌────────────────┐
  │   GenomeRegistry  │◄───────────────────────────────│      Helix      │
  │  (patch storage)  │                                 │  (the governor)  │
  └──────────────────┘                                 └────────┬─────────┘
                                                                  │
                                            reads evidence,       │ apply_mutation()
                                            reaches consensus,    │ register_organ()
                                            decides threat family │
                                                                  ▼
                                                        ┌────────────────┐
                                                        │    HostVault    │
                                                        │  (the patient)  │
                                                        └────────────────┘
```

The UI above is wired to a real GenLayer Intelligent Contract stack, not a mock:

```
contracts/
  genome_registry.py  # patch storage: title + constitution text + (for SHED_SKIN) replacement source
  host_vault.py         # v1: unlimited approvals allowed. A "host" Helix governs.
  host_vault_v2.py        # SHED_SKIN's spliced code: approve/withdraw always revert
  watchdog.py               # minimal child spawned on GROW_ORGAN
  helix.py                    # the Ward: governs N registered hosts, one global genome
evidence/                   # example evidence pages for the alarm form's placeholder text
scripts/deploy.ts           # deploys/reuses GenomeRegistry, deploys HostVault A + B +
                              # Helix, registers both hosts, writes addresses.json
addresses.json               # the one source of truth for deployed addresses - the
                              # frontend imports it directly; README's table below is
                              # kept in sync with it by hand on every redeploy
src/lib/genlayer.ts          # chain config, addresses.json import
src/lib/helix-contracts.ts    # get_state()/get_status()/get_genome() reads,
                                # approve()/raise_alarm() writes
src/lib/wallet.tsx              # RainbowKit + wagmi wallet connection
src/lib/helix-state.tsx           # polls every registered host's live state
```

`Helix` governs a set of registered `HostVault`s, sharing one global append-only genome.
`register_host(host, label)` only succeeds if the target's own `get_governor()` already
points at this Helix. `raise_alarm(host, threat_url, evidence_url)` is payable (a GEN
bond): it validates the URLs, reads them via `gl.nondet.web.render`/`gl.nondet.exec_prompt`
inside the contract, reaches validator consensus on `should_act` + `threat_family` +
`patch_id` only (never on free text), then:

- **should_act + family never seen before**: cross-contract-calls that host's
  `apply_mutation`, appends one clause to the global genome, refunds the bond.
- **should_act + family already law** (`has_clause(family)`): mutates that specific host
  the same way, but writes no second clause — `already_expressed=true` on the alarm record.
  Refunds the bond.
- **not should_act**: no mutation anywhere, bond is slashed to the Helix treasury
  (`owner`-only `withdraw_treasury`).

`infinite_approve_drain → SHED_SKIN` (freeze + splice that host's own running code to v2).
`permit_phishing_kit → GROW_ORGAN` (spawn a `Watchdog` child). `active_exploit_unknown →
CONTAIN` (freeze only — the safe default for an unmapped family). A frozen
`HostVault.approve` reverts `FROZEN_BY_HELIX`. Evidence URLs are validated against
localhost/private/loopback hosts before any validator fetches them — see
[SECURITY.md](SECURITY.md).

### Run the contracts

```bash
pip install -r requirements.txt
genvm-lint check contracts/helix.py   # repeat per contract
pytest tests/direct/ -v                # family->patch mapping, host registration,
                                         # already_expressed idempotency, false-alarm
                                         # slashing, HostVault mutation mechanics,
                                         # GenomeRegistry access control, SSRF guards
```

`genvm-lint check` passes clean (static + full validation) on all 5 contracts. CI
(`.github/workflows/ci.yml`) currently reports the direct-mode test job as
`continue-on-error`: `gltest`'s SDK downloader can't find a published runner bundle for
this contract's dependency hash on any public genvm release — an upstream tooling gap,
not a contract bug. The badge tracks lint + typecheck, both real. The live on-chain
verification below doesn't depend on this toolchain.

### Deploy and wire the app to it

```bash
cp .env.example .env
# fill in DEPLOYER_PRIVATE_KEY, then:
npm run deploy:helix                    # writes addresses.json at the repo root
npm run dev
```

Set `EXISTING_GENOME_REGISTRY` in the environment before running the deploy script to
reuse an already-live registry instead of deploying a fresh one (the script verifies it's
actually readable first, never assumes). `.env` no longer carries contract addresses —
`addresses.json` is the single source the frontend imports directly, so it can't drift
from what's actually deployed. Until `addresses.json` has real addresses, the app still
renders honestly: it never fabricates on-chain data, it just falls back to the design's
own static copy until a live read succeeds. Connect/Approve/Raise alarm all prompt for a
wallet and fail with a real error message rather than crash.

### Live deployment (GenLayer Studio Devnet, chain 61997)

| Contract | Address |
|---|---|
| GenomeRegistry | `0x8917000947c06B57CDbc10d79f544445c096913d` |
| Helix | `0x389e4f2B60f451BF6aa70291EB76e551Cc396A71` |
| HostVault (Host A) | `0x01a4295Bd14376efb7e75274497B4918051411B0` |
| HostVault (Host B) | `0x3dDA908ee7d249695a999D8FC4E4E84b80ad8645` |

Explorer: https://explorer-studio-dev.genlayer.com/. Studio Devnet is a
release-candidate environment and may reset — if these addresses stop resolving,
re-run `npm run deploy:helix` and update `addresses.json` / the Vercel project.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5031726a-b274-40aa-9c80-d7c020970fe5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
