# DEMO

Recorded on the live app (`helix-protocol-governor.vercel.app`), wallet connected to
GenLayer Studio Devnet (chain 61997). Recorded as separate clips, not one continuous
take — on-chain finalization time is real and varies run to run, so the "waiting for
consensus" stretches are trimmed/sped up in editing rather than performed live.
Target runtime: under 3:00.

**Clip 1 — Theater, live.** `HELIX`, giant, sand-on-cream. "Autonomous protocol.
Genome governor." `GEN 0 · 0 clauses`. Two host pills (Host A / Host B) — Host A
selected. Right half: the dithered patient portrait, `PATIENT LIVE` pulsing, five mute
jury dots (no alarm has happened yet, so there's no real tally to show). `HostVault V1
· Unlimited approvals allowed.` Connect wallet, click `Approve 100 ETH`, sign in
MetaMask, hold through `Signing approval… → Approval submitted. Waiting for
consensus… → Approval finalized.`

**Clip 2 — Dossier, raise an alarm on Host A.** Host A selected. The two URL fields
are empty (placeholder text hints at example evidence). Type or paste a real threat
URL, set the bond (0.01 GEN default), click `Raise alarm`, sign in MetaMask. The mono
dump advances `submitted → leader (fetching evidence, running the jury) → finalized
(validators agreed)`. Hold on the resulting real on-chain fields: `should_act`,
`host`, `family`, `patch`, `status`.

**Clip 3 — Theater, Host A frozen.** Back on Theater (it polls automatically): the
Host A pill now shows "· frozen". `Approve 100 ETH` now reads `Frozen by Helix` for
Host A — full contrast, disabled, because the contract itself is frozen and a real
`approve()` call would revert `FROZEN_BY_HELIX`. `PATIENT DEAD` for Host A. Jury dots
lit to whatever the real validator AGREE count actually was.

**Clip 4 — Dossier, same family against Host B.** Switch the host pill to Host B.
Raise the *same* threat family's URL again. The result reads `ALREADY LAW - this
family was already ruled on, no new splice` — but switching Theater to Host B still
shows it frozen: the genome is global, the enforcement is per-host, and no duplicate
clause was written (`GEN` stays at 1).

**Clip 5 — Log.** The real genome: one clause, oldest first. Below it, the recent
alarms table showing both alarms — Host A `ACTED`, Host B `ALREADY LAW` — real
on-chain rows, not a staged sequence.

**Clip 6 — close on the one line, spoken once:** "Helix read the web, the jury
agreed, and the law it wrote held for every vault it watches."
