# DEMO

Recorded on the live app (`helix-protocol-governor.vercel.app`), wallet connected to
GenLayer Studio Devnet (chain 61997). Recorded as separate clips, not one continuous
take — on-chain finalization time is real and varies run to run, so the "waiting for
consensus" stretches are trimmed/sped up in editing rather than performed live.
Target runtime: under 3:00.

**Clip 1 — Theater, live.** `HELIX`, giant, sand-on-cream. "Autonomous protocol.
Genome governor." Right half: the dithered patient portrait, `PATIENT LIVE` pulsing,
five mute jury dots (no ingest has happened yet, so there's no real tally to show —
the dots never claim a fake number). `HostVault V1 · Unlimited approvals allowed.`
Connect wallet, click `Approve 100 ETH`, sign in MetaMask, hold through
`Signing approval… → Approval submitted. Waiting for consensus… → Approval finalized.`

**Clip 2 — Dossier.** The two evidence URLs are prefilled. Click `Ingest threat`, sign
in MetaMask. The mono dump advances `submitted → leader (fetching evidence, running
the jury) → finalized (validators agreed)`. Hold on the resulting real on-chain
fields, not composed in the browser: `should_act`, `family`, `patch`, the model's own
rationale, and the evidence source URLs.

**Clip 3 — Theater, frozen.** Back on Theater (it polls automatically): `HostVault
V2`. `Approve 100 ETH` now reads `Frozen by Helix` — full contrast, not greyed out,
and disabled, because the contract itself is frozen and a real `approve()` call would
revert `FROZEN_BY_HELIX`. The caption line underneath spells out why: "...vault
frozen by Helix after infinite_approve_drain consensus." `PATIENT DEAD`, jury dots lit
to whatever the real validator AGREE count from Clip 2 actually was (not assumed to be
any fixed number).

**Clip 4 — Log.** The four-frame genome sequence: `01 V1 live → 02 Ingest → 03 Jury
N/5 → 04 V2 spliced`. Oldest first, exactly what just happened, dithered stills
matching the Theater's own visual system.

**Clip 5 — close on the one line, spoken once:** "Helix read the web, the jury
agreed, the vault rewrote itself."
