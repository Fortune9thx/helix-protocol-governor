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
  host_vault.py         # v1: unlimited approvals allowed. The "patient".
  host_vault_v2.py        # SHED_SKIN's spliced code: approve/withdraw always revert
  watchdog.py               # minimal child spawned on GROW_ORGAN
  helix.py                    # the governor: ingest_threat() runs the consensus round
evidence/                   # the two evidence pages the jury fetches for the demo
scripts/deploy.ts           # deploys GenomeRegistry, HostVault, Helix + registers all
                              # patches (host_vault_v2.py's source ships as the
                              # SHED_SKIN patch, not a separately deployed contract),
                              # prints addresses for .env
src/lib/genlayer.ts          # chain config, MetaMask connect/switch-network
src/lib/helix-contracts.ts    # get_state()/get_status() reads, approve()/ingest_threat() writes
src/lib/wallet.tsx              # wallet context (address, connect())
src/lib/helix-state.tsx           # polls live chain state every 4s; `spliced` = preview toggle OR host.frozen
```

`Helix.ingest_threat` reads two evidence URLs via `gl.nondet.web.render`/`gl.nondet.exec_prompt`
inside the contract, reaches validator consensus on `should_act` + `threat_family` +
`patch_id` only (never on free text), then cross-contract-calls `HostVault.apply_mutation`.
`infinite_approve_drain → SHED_SKIN` (freeze + splice HostVault's own running code to v2).
`permit_phishing_kit → GROW_ORGAN` (spawn a `Watchdog` child). A frozen `HostVault.approve`
reverts `FROZEN_BY_HELIX`. Evidence URLs are validated against localhost/private/
loopback hosts before any validator fetches them — see [SECURITY.md](SECURITY.md).

### Run the contracts

```bash
pip install -r requirements.txt
genvm-lint check contracts/helix.py   # repeat per contract
pytest tests/direct/ -v                # 25 tests: family->patch mapping, HostVault mutation
                                         # mechanics, GenomeRegistry access control, evidence-URL SSRF guards
```

### Deploy and wire the app to it

```bash
cp .env.example .env
# fill in DEPLOYER_PRIVATE_KEY and (once this repo is pushed) the two evidence URLs
npm run deploy:helix                    # prints VITE_HOST_VAULT_ADDRESS / VITE_HELIX_ADDRESS / VITE_GENOME_REGISTRY_ADDRESS
# paste those three lines into .env, then:
npm run dev
```

Until `.env` has real addresses, the app still renders honestly: it never fabricates
on-chain data, it just falls back to the design's own static copy (`HostVault V1 ·
Unlimited approvals allowed.`) until a live read succeeds. Connect/Approve/Ingest all
prompt for a wallet and fail with a real error message rather than crash.

### Live deployment (GenLayer Studio Devnet, chain 61997)

| Contract | Address |
|---|---|
| GenomeRegistry | `0x8917000947c06B57CDbc10d79f544445c096913d` |
| HostVault | `0xba958e66e8a488C557A291c84980681e90A87EF3` |
| Helix | `0xa74F459E56C56669d8ac4Cf352E9484471E9cd03` |

Explorer: https://explorer-studio-dev.genlayer.com/. Studio Devnet is a
release-candidate environment and may reset — if these addresses stop resolving,
re-run `npm run deploy:helix` and update `.env` / the Vercel project's env vars.

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
