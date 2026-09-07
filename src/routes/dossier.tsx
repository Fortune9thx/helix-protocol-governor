import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import barcode from "../assets/helix-barcode.jpg";
import { EVIDENCE_DRAIN_URL, EVIDENCE_PHISH_URL } from "../lib/genlayer";
import { useHelix } from "../lib/helix-state";
import { useWallet } from "../lib/wallet";
import { ingestThreat, readableError, waitForTx } from "../lib/helix-contracts";

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
  const { status, refresh } = useHelix();
  const { address, connect } = useWallet();

  async function onIngest() {
    if (!address) {
      await connect();
      return;
    }
    setFailure(null);
    setPending("submitted   : awaiting signature");
    try {
      const hash = await ingestThreat(address, threat.trim(), evidence.trim());
      setPending("leader      : fetching evidence, running the jury");
      await waitForTx(hash);
      setPending("finalized    : validators agreed");
      await refresh();
      setPending(null);
    } catch (err) {
      setFailure(readableError(err));
      setPending(null);
    }
  }

  // The verdict is read back off-chain state, never composed in the browser.
  const dump = pending
    ? pending
    : failure
      ? `error        : ${failure}`
      : status && status.mutationCount !== "0"
        ? [
            `should_act   : ${status.lastPatch !== "NONE"}`,
            `family       : ${status.lastFamily || "—"}`,
            `patch        : ${status.lastPatch}`,
            `rationale    : ${status.lastRationale || "—"}`,
            `sources      : ${status.lastUrls || "—"}`,
          ].join("\n")
        : null;

  return (
    <main className="min-h-screen bg-cream px-8 pt-32 pb-36 md:px-14">
      <h1 className="text-[16vw] leading-[0.84] text-ink md:text-[8vw]">Dossier</h1>
      <p className="mt-6 max-w-sm text-base text-ink/70">Evidence the jury fetched.</p>
      <div className="mt-8 h-px w-full bg-ink/15" />

      <img
        src={barcode}
        alt="Slit-scan barcode rendering of the ingested evidence stream"
        width={1920}
        height={960}
        loading="lazy"
        className="mt-10 h-[300px] w-full object-cover md:h-[360px]"
      />

      <div className="mt-14 grid max-w-4xl gap-8 md:grid-cols-2">
        <label className="block">
          <span className="font-mono text-xs tracking-[0.2em] text-ink/50 uppercase">
            Threat URL
          </span>
          <input
            value={threat}
            onChange={(e) => setThreat(e.target.value)}
            placeholder="https://"
            className="mt-3 w-full border-b border-ink/25 bg-transparent pb-3 text-lg tracking-tight text-ink outline-none placeholder:text-ink/25 focus:border-ink"
          />
        </label>
        <label className="block">
          <span className="font-mono text-xs tracking-[0.2em] text-ink/50 uppercase">
            Evidence URL
          </span>
          <input
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="https://"
            className="mt-3 w-full border-b border-ink/25 bg-transparent pb-3 text-lg tracking-tight text-ink outline-none placeholder:text-ink/25 focus:border-ink"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => void onIngest()}
        disabled={pending !== null}
        className="mt-10 rounded-full bg-ink px-8 py-4 text-base tracking-tight text-cream transition-opacity hover:opacity-85"
      >
        Ingest threat
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
