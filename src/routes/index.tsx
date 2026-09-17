import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useHelix } from "../lib/helix-state";
import { useHelixWallet } from "../lib/wallet";
import { approve, readableError, waitForTx } from "../lib/helix-contracts";
import { Button } from "../components/ui/button";
import { PixelGlyph } from "../components/PixelGlyph";
import { JuryDots } from "../components/JuryDots";

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
  const { hosts, selectedHost, setSelectedHost, spliced, hostStates, status, refresh, ingesting, jury } = useHelix();
  const { client, address, openConnectModal } = useHelixWallet();
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const host = hostStates[selectedHost];

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

  async function onApprove() {
    if (!client || !address) {
      openConnectModal?.();
      return;
    }
    setPending(true);
    setNote("Signing approval…");
    try {
      const hash = await approve(client, selectedHost, address, APPROVE_AMOUNT_WEI);
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

  const lastTx = note ? note.replace("Approval ", "").replace(".", "") : "—";

  return (
    <main className="relative flex min-h-screen flex-col overflow-y-auto bg-background px-5 pt-24 pb-24 text-foreground md:h-screen md:px-10 md:pt-28 md:pb-20">
      <section className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col">
        <div className="flex flex-1 items-center justify-between gap-8">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] text-muted-foreground uppercase">
              STUDIO-DEV — 61997 / GEN {status?.generation ?? "0"}
              {ingesting && <span className="ml-3 text-law">· ALARM IN FLIGHT ON DOSSIER</span>}
            </p>
            <h1 className="mt-5 text-[25vw] leading-[0.72] text-foreground sm:text-[20vw] md:text-[15.5vw] lg:text-[14vw]">HELIX</h1>
            <p className="mt-6 font-mono text-[10px] text-muted-foreground uppercase md:text-xs">AUTONOMOUS PROTOCOL — GENOME GOVERNOR</p>

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
                    {hostStates[h.address]?.frozen ? " · frozen" : ""}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
              <Button
                type="button"
                onClick={() => void onApprove()}
                disabled={spliced || pending}
                className={`helix-action ${pending ? "is-pending" : ""} ${spliced ? "is-frozen" : ""}`}
              >
                <span key={spliceFlipKey} className="helix-label-fade">
                  {spliced ? "FROZEN BY HELIX" : pending ? "APPROVING" : "Approve 100 ETH"}
                </span>
              </Button>
              <span className="max-w-sm font-mono text-[9px] text-muted-foreground uppercase sm:text-[10px]">HostVault {version} · {line}</span>
            </div>
          </div>

          <div className="flex w-24 shrink-0 flex-col items-center gap-5 sm:w-32 md:w-56 lg:w-72">
            <PixelGlyph
              key={`splice-${spliceFlipKey}`}
              kind={spliced ? "dead" : "live"}
              className={`w-full text-foreground ${spliced ? "helix-glitch-once" : "helix-float"}`}
            />
            <p key={`status-${spliceFlipKey}`} className="number-tick font-mono text-[10px] text-muted-foreground uppercase">PATIENT {spliced ? "DEAD" : "LIVE"}</p>
            <JuryDots tally={jury} className="mt-1" />
          </div>
        </div>

        <div className="grid border-t border-line md:grid-cols-3">
          {[
            ["01", "HOST", `HostVault ${version}`],
            ["02", "STATUS", spliced ? "DEAD / FROZEN" : "LIVE / APPROVE ON"],
            ["03", "LAST TX", lastTx],
          ].map(([n, label, value]) => (
            <div key={n} className="grid grid-cols-[3rem_1fr] gap-3 border-b border-line py-4 md:block md:border-r md:border-b-0 md:px-6 md:first:pl-0">
              <span className="font-mono text-[10px] text-muted-foreground">{n}</span>
              <div className="md:mt-7">
                <p className="font-mono text-[9px] text-muted-foreground uppercase">{label}</p>
                <p key={`${value}-${spliceFlipKey}`} className="number-tick mt-1 truncate text-sm uppercase">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="ticker fixed inset-x-0 bottom-0 z-30 h-8 overflow-hidden border-t border-line bg-background font-mono text-[9px] text-muted-foreground uppercase">
        <div className="ticker-track flex h-full w-max items-center whitespace-nowrap">
          {Array.from({ length: 6 }, (_, i) => <span key={i} className="px-8">PATIENT {spliced ? "DEAD" : "LIVE"} · {spliced ? "APPROVE FROZEN" : "UNLIMITED APPROVE ON"} · POLL 20S · GEN {status?.generation ?? "0"} ·</span>)}
        </div>
      </div>
    </main>
  );
}
