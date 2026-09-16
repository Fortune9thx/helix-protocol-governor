import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import barcode from "../assets/helix-barcode.jpg";
import { EVIDENCE_DRAIN_URL, EVIDENCE_PHISH_URL } from "../lib/genlayer";
import { useHelix } from "../lib/helix-state";
import { useHelixWallet } from "../lib/wallet";
import { raiseAlarm, readableError, readRecentAlarms, waitForTx, type Alarm } from "../lib/helix-contracts";

export const Route = createFileRoute("/dossier")({
  head: () => ({
    meta: [
      { title: "HELIX — Dossier | Raise an alarm" },
      {
        name: "description",
        content: "File an alarm against a registered host and read the jury verdict dump.",
      },
      { property: "og:title", content: "HELIX — Dossier" },
      {
        property: "og:description",
        content: "File an alarm against a registered host and read the HELIX jury verdict dump.",
      },
    ],
  }),
  component: Dossier,
});

const DEFAULT_BOND_GEN = "0.01";

function Dossier() {
  const { hosts, selectedHost, setSelectedHost, refresh, setIngesting, recordJury } = useHelix();
  const { client, openConnectModal } = useHelixWallet();

  const [threat, setThreat] = useState("");
  const [evidence, setEvidence] = useState("");
  const [bond, setBond] = useState(DEFAULT_BOND_GEN);
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [lastAlarm, setLastAlarm] = useState<Alarm | null>(null);

  async function onRaiseAlarm() {
    if (!client) {
      openConnectModal?.();
      return;
    }
    setFailure(null);
    setPending("submitted   : awaiting signature");
    setIngesting(true);
    try {
      const bondWei = BigInt(Math.round(Number(bond) * 1e18));
      const hash = await raiseAlarm(client, selectedHost, threat.trim(), evidence.trim(), bondWei);
      setPending("leader      : fetching evidence, running the jury");
      const tally = await waitForTx(hash);
      recordJury(tally);
      setPending("finalized    : validators agreed");
      const [latest] = await readRecentAlarms(1);
      if (latest) setLastAlarm(latest);
      await refresh();
      setPending(null);
    } catch (err) {
      setFailure(readableError(err));
      setPending(null);
    } finally {
      setIngesting(false);
    }
  }

  const dump = pending
    ? pending
    : failure
      ? `error        : ${failure}`
      : lastAlarm
        ? [
            lastAlarm.alreadyExpressed
              ? "verdict      : ALREADY LAW - this family was already ruled on, no new splice"
              : `should_act   : ${lastAlarm.shouldAct}`,
            `host         : ${lastAlarm.host}`,
            `family       : ${lastAlarm.family || "—"}`,
            `patch        : ${lastAlarm.patchId}`,
            `status       : ${lastAlarm.status}`,
          ].join("\n")
        : null;

  return (
    <main className="min-h-screen bg-cream px-8 pt-32 pb-36 md:px-14">
      <h1 className="text-[16vw] leading-[0.84] text-ink md:text-[8vw]">Dossier</h1>
      <p className="mt-6 max-w-sm text-base text-ink/70">Raise an alarm against a registered host.</p>
      <div className="mt-8 h-px w-full bg-ink/15" />

      <img
        src={barcode}
        alt="Slit-scan barcode rendering of the ingested evidence stream"
        width={1920}
        height={960}
        loading="lazy"
        className="mt-10 h-[300px] w-full object-cover md:h-[360px]"
      />

      {hosts.length > 1 && (
        <div className="mt-10 flex flex-wrap gap-2">
          {hosts.map((h) => (
            <button
              key={h.address}
              type="button"
              onClick={() => setSelectedHost(h.address)}
              className={
                "rounded-full border px-4 py-1.5 font-mono text-xs tracking-[0.15em] uppercase transition-colors " +
                (h.address === selectedHost
                  ? "border-ink bg-ink text-cream"
                  : "border-ink/20 text-ink/60 hover:border-ink/50")
              }
            >
              {h.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 grid max-w-4xl gap-8 md:grid-cols-2">
        <label className="block">
          <span className="font-mono text-xs tracking-[0.2em] text-ink/50 uppercase">
            Threat URL
          </span>
          <input
            value={threat}
            onChange={(e) => setThreat(e.target.value)}
            placeholder={EVIDENCE_DRAIN_URL || "https://"}
            className="mt-3 w-full border-b border-ink/25 bg-transparent pb-3 text-lg tracking-tight text-ink outline-none placeholder:text-ink/25 focus:border-ink"
          />
        </label>
        <label className="block">
          <span className="font-mono text-xs tracking-[0.2em] text-ink/50 uppercase">
            Evidence URL (optional)
          </span>
          <input
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder={EVIDENCE_PHISH_URL || "https://"}
            className="mt-3 w-full border-b border-ink/25 bg-transparent pb-3 text-lg tracking-tight text-ink outline-none placeholder:text-ink/25 focus:border-ink"
          />
        </label>
      </div>

      <label className="mt-8 block max-w-xs">
        <span className="font-mono text-xs tracking-[0.2em] text-ink/50 uppercase">
          Bond (GEN)
        </span>
        <input
          value={bond}
          onChange={(e) => setBond(e.target.value)}
          type="number"
          min="0.01"
          step="0.01"
          className="mt-3 w-full border-b border-ink/25 bg-transparent pb-3 text-lg tracking-tight text-ink outline-none focus:border-ink"
        />
        <span className="mt-2 block text-xs text-ink/45">
          Refunded if the alarm is correct. Slashed to the treasury if it's noise.
        </span>
      </label>

      <button
        type="button"
        onClick={() => void onRaiseAlarm()}
        disabled={pending !== null}
        className="mt-10 rounded-full bg-ink px-8 py-4 text-base tracking-tight text-cream transition-opacity hover:opacity-85"
      >
        Raise alarm
      </button>

      <pre className="mt-10 max-w-3xl overflow-x-auto border-t border-ink/15 pt-6 font-mono text-xs leading-relaxed text-ink/75">
        {dump ?? [
          "should_act   : —",
          "family       : —",
          "patch        : —",
        ].join("\n")}
      </pre>
    </main>
  );
}
