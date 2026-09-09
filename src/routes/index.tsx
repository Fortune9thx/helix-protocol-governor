import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import portrait from "../assets/helix-portrait.jpg";
import { useHelix } from "../lib/helix-state";
import { useWallet } from "../lib/wallet";
import { approve, readableError, waitForTx } from "../lib/helix-contracts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HELIX — Theater | Autonomous vault governor" },
      {
        name: "description",
        content:
          "HELIX theater: live vault state, approval control and patient signal for the autonomous genome governor.",
      },
      { property: "og:title", content: "HELIX — Theater" },
      {
        property: "og:description",
        content: "Live vault state, approval control and patient signal for the HELIX governor.",
      },
    ],
  }),
  component: Theater,
});

const APPROVE_AMOUNT_WEI = 100n * 10n ** 18n;

function Theater() {
  const { spliced, host, refresh, ingesting, jury } = useHelix();
  const { address, connect } = useWallet();
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // PATIENT DEAD's glitch and the Approve label's fade must each fire once,
  // exactly when spliced flips false -> true (or back), not on every
  // unrelated re-render - remounting the element via a bumped key restarts
  // its one-shot CSS animation without any timer bookkeeping.
  const prevSpliced = useRef(spliced);
  const [spliceFlipKey, setSpliceFlipKey] = useState(0);
  useEffect(() => {
    if (spliced !== prevSpliced.current) {
      setSpliceFlipKey((k) => k + 1);
    }
    prevSpliced.current = spliced;
  }, [spliced]);

  // Jury dots should only replay their "tick in" animation right after a
  // real ingest finishes, never on an ordinary re-render or on load from a
  // stored tally.
  const prevIngesting = useRef(ingesting);
  const [tallyKey, setTallyKey] = useState(0);
  useEffect(() => {
    if (!ingesting && prevIngesting.current) {
      setTallyKey((k) => k + 1);
    }
    prevIngesting.current = ingesting;
  }, [ingesting]);

  // Pause the dither portrait's scanline while the tab is hidden.
  const [tabHidden, setTabHidden] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => setTabHidden(document.visibilityState === "hidden");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  async function onApprove() {
    if (!address) {
      await connect();
      return;
    }
    setPending(true);
    setNote("Signing approval…");
    try {
      const hash = await approve(address, address, APPROVE_AMOUNT_WEI);
      setNote("Approval submitted. Waiting for consensus…");
      await waitForTx(hash);
      setNote("Approval finalized.");
      await refresh();
    } catch (err) {
      setNote(readableError(err));
    } finally {
      setPending(false);
    }
  }

  // Real genome version once the chain is readable, else the design's own default.
  const version = host ? `V${host.genomeVersion}` : spliced ? "V2" : "V1";
  const line = note ?? host?.constitution ?? "Unlimited approvals allowed.";

  const juryTotal = jury?.total ?? 5;
  const juryLit = ingesting ? 0 : (jury?.agree ?? 0);
  const juryLabel = jury ? `${jury.agree} / ${jury.total}` : ingesting ? "…" : "— / —";

  return (
    <div className="grid h-screen w-full grid-cols-1 overflow-hidden md:grid-cols-2">
      <section className="flex flex-col justify-center bg-sand px-8 pt-24 pb-28 md:px-14">
        <h1 className="text-[18vw] leading-[0.82] tracking-[-0.055em] text-ink md:text-[10.5vw]">
          HELIX
        </h1>
        <p className="mt-6 max-w-md text-base text-ink/70">
          Autonomous protocol. Genome governor.
        </p>
        <div className="mt-8 h-px w-full max-w-md bg-ink/20" />
        <div className="mt-8">
          <button
            type="button"
            onClick={() => void onApprove()}
            disabled={spliced || pending}
            className={
              "inline-flex min-w-[12rem] items-center justify-center whitespace-nowrap rounded-full bg-ink px-8 py-4 text-base tracking-tight text-cream transition-opacity hover:opacity-85 " +
              (pending ? "opacity-60" : "")
            }
          >
            <span key={spliceFlipKey} className="helix-label-fade">
              {spliced ? "Frozen by Helix" : "Approve 100 ETH"}
            </span>
          </button>
          <p className="mt-4 font-mono text-xs tracking-wide text-ink/55 uppercase">
            HostVault {version} · {line}
          </p>
        </div>
      </section>

      <section className="relative hidden overflow-hidden bg-ink md:block">
        <img
          src={portrait}
          alt="Dithered portrait of the governed patient"
          width={1024}
          height={1280}
          className="h-full w-full object-cover opacity-90"
        />
        <div
          data-paused={tabHidden}
          className="helix-scanline pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-transparent via-bone/10 to-transparent"
        />
        <div className="absolute inset-0 p-10 pt-28">
          <div className="flex flex-col items-start gap-5">
            <span
              key={`splice-${spliceFlipKey}`}
              className={
                "font-mono text-xs tracking-[0.25em] text-bone/85 uppercase " +
                (spliced ? "helix-glitch-once" : "helix-pulse")
              }
            >
              {spliced ? "PATIENT DEAD" : "PATIENT LIVE"}
            </span>
            <div key={`tally-${tallyKey}`} className="flex items-center gap-3">
              {Array.from({ length: juryTotal }, (_, i) => (
                <span
                  key={`dot-${i}`}
                  style={{ animationDelay: `${i * (ingesting ? 150 : 100)}ms` }}
                  className={
                    "h-2 w-2 rounded-[1px] " +
                    (ingesting
                      ? "helix-dot-scanning bg-bone"
                      : i < juryLit
                        ? "helix-dot-tick bg-bone"
                        : "bg-bone/25")
                  }
                />
              ))}
              <span className="ml-3 font-mono text-xs tracking-[0.2em] text-bone/60">
                {juryLabel}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
