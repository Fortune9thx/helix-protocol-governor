import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EVIDENCE_DRAIN_URL, EVIDENCE_PHISH_URL } from "../lib/genlayer";
import { useHelix } from "../lib/helix-state";
import { useHelixWallet } from "../lib/wallet";
import { ingestThreat, readableError, waitForTx } from "../lib/helix-contracts";
import { Button } from "../components/ui/button";
import { PixelGlyph } from "../components/PixelGlyph";

export const Route = createFileRoute("/dossier")({
  head: () => ({
    meta: [
      { title: "HELIX — Dossier | Evidence the jury fetched" },
      {
        name: "description",
        content: "Ingest threat and evidence sources into the HELIX dossier and read the jury verdict dump.",
      },
      { property: "og:title", content: "HELIX — Dossier" },
      {
        property: "og:description",
        content: "Ingest threat and evidence sources and read the HELIX jury verdict dump.",
      },
    ],
  }),
  component: Dossier,
});

function Dossier() {
  const [threat, setThreat] = useState(EVIDENCE_DRAIN_URL || "https://");
  const [evidence, setEvidence] = useState(EVIDENCE_PHISH_URL || "https://");
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const { status, refresh, setIngesting, recordJury } = useHelix();
  const { client, openConnectModal } = useHelixWallet();

  async function onIngest() {
    if (!client) {
      openConnectModal?.();
      return;
    }
    setFailure(null);
    setPending("submitted   : awaiting signature");
    setIngesting(true);
    try {
      const hash = await ingestThreat(client, threat.trim(), evidence.trim());
      setPending("leader      : fetching evidence, running the jury");
      const tally = await waitForTx(hash);
      recordJury(tally);
      setPending("finalized    : validators agreed");
      await refresh();
      setPending(null);
    } catch (err) {
      setFailure(readableError(err));
      setPending(null);
    } finally {
      setIngesting(false);
    }
  }

  // The verdict is read back off-chain state, never composed in the browser.
  const dump = pending
    ? pending
    : failure
      ? `error        : ${failure}`
      : status && status.mutationCount !== "0"
        ? [
            status.alreadyExpressed
              ? "verdict      : ALREADY LAW - this family was already ruled on, no new splice"
              : `should_act   : ${status.lastPatch !== "NONE"}`,
            `family       : ${status.lastFamily || "—"}`,
            `patch        : ${status.lastPatch}`,
            `rationale    : ${status.lastRationale || "—"}`,
            `sources      : ${status.lastUrls || "—"}`,
            `generation   : ${status.generation}`,
          ].join("\n")
        : null;
  const activeStep = pending?.startsWith("submitted") ? 0 : pending?.startsWith("leader") ? 2 : pending?.startsWith("finalized") ? 3 : -1;
  const result = status && status.mutationCount !== "0" ? status : null;

  return (
    <main className="min-h-screen bg-background px-5 pt-24 pb-20 text-foreground md:px-10 md:pt-28">
      <div className="mx-auto w-full max-w-[1600px]">
      <p className="font-mono text-[10px] text-muted-foreground uppercase">ALARM INTERFACE — EVIDENCE INTAKE</p>
      <h1 className="mt-5 text-[18vw] leading-[0.78] text-foreground md:text-[11vw]">DOSSIER</h1>
      <p className="mt-6 font-mono text-[10px] text-muted-foreground uppercase md:text-xs">FILE AN ALARM — VALIDATORS FETCH THE PAGE</p>
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
            placeholder="https://"
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
            placeholder="https://"
            className="mt-3 w-full border-b border-line bg-transparent pb-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
          />
        </label>
      </div>

      <Button
        type="button"
        onClick={() => void onIngest()}
        disabled={pending !== null}
        className={`helix-action mt-10 ${pending ? "is-pending" : ""}`}
      >
        {pending ? "PROCESSING" : "Ingest threat"}
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
          ["01", "SHOULD ACT", result ? String(result.lastPatch !== "NONE") : "—"],
          ["02", "FAMILY", result?.lastFamily || "—"],
          ["03", "PATCH", result?.lastPatch || "—"],
          ["04", "ALREADY EXPRESSED", result ? String(result.alreadyExpressed) : "—"],
        ].map(([n, label, value]) => (
          <div key={label} className="border-b border-line py-5 md:border-r md:px-5 md:first:pl-0">
            <p className="font-mono text-[9px] text-muted-foreground">{n} — {label}</p>
            <p className={`mt-5 truncate text-sm uppercase ${label === "ALREADY EXPRESSED" && result?.alreadyExpressed ? "text-law" : "text-foreground"}`}>
              {label === "ALREADY EXPRESSED" && result?.alreadyExpressed ? "ALREADY LAW" : value}
            </p>
          </div>
        ))}
      </div>
      {(failure || dump) && <p className="mt-5 max-w-4xl font-mono text-[10px] text-muted-foreground">{failure ?? dump}</p>}
      </div>
    </main>
  );
}
