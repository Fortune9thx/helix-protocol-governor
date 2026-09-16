import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { readGenome, type GenomeClause } from "../lib/helix-contracts";
import { isConfigured } from "../lib/genlayer";
import { PixelGlyph } from "../components/PixelGlyph";

export const Route = createFileRoute("/log")({
  head: () => ({
    meta: [
      { title: "HELIX — Genome | Vault mutation log" },
      {
        name: "description",
        content: "The HELIX genome log: every law-clause the governor has actually written on-chain.",
      },
      { property: "og:title", content: "HELIX — Genome" },
      {
        property: "og:description",
        content: "The HELIX genome log: every law-clause the governor has actually written on-chain.",
      },
    ],
  }),
  component: Log,
});

function Log() {
  const [clauses, setClauses] = useState<GenomeClause[] | null>(null);

  useEffect(() => {
    if (!isConfigured()) {
      setClauses([]);
      return;
    }
    let cancelled = false;
    void readGenome()
      .then((c) => {
        if (!cancelled) setClauses(c);
      })
      .catch(() => {
        if (!cancelled) setClauses([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background px-5 pt-24 pb-20 text-foreground md:px-10 md:pt-28">
      <div className="mx-auto w-full max-w-[1600px]">
      <p className="font-mono text-[10px] text-muted-foreground uppercase">SELF-MODIFICATION LEDGER — GET_GENOME()</p>
      <h1 className="mt-5 text-[18vw] leading-[0.78] text-foreground md:text-[11vw]">GENOME</h1>
      <p className="mt-6 font-mono text-[10px] text-muted-foreground uppercase md:text-xs">CLAUSES HELIX WROTE ONTO ITSELF</p>
      <div className="mt-8 h-px w-full bg-line" />

      {clauses === null ? (
        <p className="mt-16 font-mono text-xs text-muted-foreground uppercase">
          Reading genome…
        </p>
      ) : clauses.length === 0 ? (
        <div className="mt-16 flex items-center gap-6">
          <PixelGlyph kind="empty" className="w-16 text-foreground" />
          <p className="font-mono text-xs text-muted-foreground uppercase">NO CLAUSES — GENOME EMPTY</p>
        </div>
      ) : (
        <div className="mt-8">
          {clauses.map((c) => (
            <article key={c.clauseId} className="grid gap-4 border-b border-line py-6 md:grid-cols-[4rem_1fr_1fr_1fr_1fr] md:items-center">
              <p className="font-mono text-xs text-muted-foreground">{c.clauseId.padStart(2, "0")}</p>
              <div><p className="font-mono text-[9px] text-muted-foreground uppercase">FAMILY</p><p className="mt-1 text-sm uppercase">{c.family}</p></div>
              <div><p className="font-mono text-[9px] text-muted-foreground uppercase">PATCH</p><p className="mt-1 text-sm uppercase">{c.patchId}</p></div>
              <div><p className="font-mono text-[9px] text-muted-foreground uppercase">ALREADY EXPRESSED</p><p className={`mt-1 text-sm uppercase ${c.expressed ? "text-law" : ""}`}>{c.expressed ? "ALREADY LAW" : "FALSE"}</p></div>
              <div><p className="font-mono text-[9px] text-muted-foreground uppercase">TIME / GEN</p><p className="mt-1 text-sm uppercase">GEN {c.writtenGen}</p></div>
            </article>
          ))}
        </div>
      )}
      </div>
    </main>
  );
}
