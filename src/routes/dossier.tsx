import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EVIDENCE_DRAIN_URL, EVIDENCE_PHISH_URL } from "../lib/genlayer";
import { useHelix } from "../lib/helix-state";
import { useHelixWallet } from "../lib/wallet";
import { raiseAlarm, readableError, readRecentAlarms, waitForTx, type Alarm } from "../lib/helix-contracts";
import { Button } from "../components/ui/button";
import { PixelGlyph } from "../components/PixelGlyph";

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

  const dump = failure ? `error        : ${failure}` : null;
  const activeStep = pending?.startsWith("submitted")
    ? 0
    : pending?.startsWith("leader")
      ? 2
      : pending?.startsWith("finalized")
        ? 3
        : -1;

  return (
    <main className="min-h-screen bg-background px-5 pt-24 pb-20 text-foreground md:px-10 md:pt-28">
      <div className="mx-auto w-full max-w-[1600px]">
        <p className="font-mono text-[10px] text-muted-foreground uppercase">ALARM INTERFACE — EVIDENCE INTAKE</p>
        <h1 className="mt-5 text-[18vw] leading-[0.78] text-foreground md:text-[11vw]">DOSSIER</h1>
        <p className="mt-6 font-mono text-[10px] text-muted-foreground uppercase md:text-xs">FILE AN ALARM — VALIDATORS FETCH THE PAGE</p>

        {hosts.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {hosts.map((h) => (
              <button
                key={h.address}
                type="button"
                onClick={() => setSelectedHost(h.address)}
                className={
                  "rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors " +
                  (h.address === selectedHost
                    ? "border-foreground bg-foreground text-background"
                    : "border-line text-muted-foreground hover:border-foreground/50 hover:text-foreground")
                }
              >
                {h.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-8 h-px w-full bg-line" />

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_18rem]">
          <div>
            <div className="grid gap-8 md:grid-cols-2">
              <label className="block">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">
                  Threat URL
                </span>
                <input
                  value={threat}
                  onChange={(e) => setThreat(e.target.value)}
                  placeholder={EVIDENCE_DRAIN_URL || "https://"}
                  className="mt-3 w-full border-b border-line bg-transparent pb-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
                />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">
                  Evidence URL
                </span>
                <input
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder={EVIDENCE_PHISH_URL || "https://"}
                  className="mt-3 w-full border-b border-line bg-transparent pb-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
                />
              </label>
            </div>

            <label className="mt-8 block max-w-xs">
              <span className="font-mono text-[10px] text-muted-foreground uppercase">
                Bond (GEN)
              </span>
              <input
                value={bond}
                onChange={(e) => setBond(e.target.value)}
                type="number"
                min="0.01"
                step="0.01"
                className="mt-3 w-full border-b border-line bg-transparent pb-3 text-base text-foreground outline-none focus:border-foreground"
              />
              <span className="mt-2 block font-mono text-[9px] text-muted-foreground uppercase">
                Refunded if correct. Slashed to treasury if noise.
              </span>
            </label>

            <Button
              type="button"
              onClick={() => void onRaiseAlarm()}
              disabled={pending !== null}
              className={`helix-action mt-10 ${pending ? "is-pending" : ""}`}
            >
              {pending ? "PROCESSING" : "Raise alarm"}
            </Button>

            <div className="mt-10 grid grid-cols-4 border-t border-line pt-4">
              {["SIGNED", "FETCH", "JURY", "FINAL"].map((step, index) => (
                <div key={step} className={`font-mono text-[9px] ${activeStep >= index ? "text-foreground" : "text-muted-foreground"}`}>
                  <span className="mr-2">{activeStep >= index ? "■" : "□"}</span>{step}
                </div>
              ))}
            </div>
          </div>
          <div className="flex min-h-48 items-center justify-center border-l border-line max-lg:border-l-0 max-lg:border-t max-lg:pt-10">
            <PixelGlyph kind={pending ? "spinner" : "live"} className={`w-28 text-foreground ${pending ? "pixel-spin" : "helix-float"}`} />
          </div>
        </div>

        <div className="mt-12 grid border-t border-line md:grid-cols-4">
          {[
            ["01", "SHOULD ACT", lastAlarm ? String(lastAlarm.shouldAct) : "—"],
            ["02", "FAMILY", lastAlarm?.family || "—"],
            ["03", "PATCH", lastAlarm?.patchId || "—"],
            ["04", "ALREADY EXPRESSED", lastAlarm ? String(lastAlarm.alreadyExpressed) : "—"],
          ].map(([n, label, value]) => (
            <div key={label} className="border-b border-line py-5 md:border-r md:px-5 md:first:pl-0">
              <p className="font-mono text-[9px] text-muted-foreground">{n} — {label}</p>
              <p className={`mt-5 truncate text-sm uppercase ${label === "ALREADY EXPRESSED" && lastAlarm?.alreadyExpressed ? "text-law" : "text-foreground"}`}>
                {label === "ALREADY EXPRESSED" && lastAlarm?.alreadyExpressed ? "ALREADY LAW" : value}
              </p>
            </div>
          ))}
        </div>
        {(failure || dump) && <p className="mt-5 max-w-4xl font-mono text-[10px] text-muted-foreground">{failure ?? dump}</p>}
      </div>
    </main>
  );
}
