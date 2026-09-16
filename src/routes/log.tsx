import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { readGenome, type GenomeClause } from "../lib/helix-contracts";
import { isConfigured } from "../lib/genlayer";

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
    <main className="min-h-screen bg-cream px-8 pt-32 pb-24 md:px-14">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
        <h1 className="text-[16vw] leading-[0.84] text-ink md:text-[8vw]">Genome</h1>
        <p className="max-w-sm text-sm text-ink/65 md:mt-6">
          Every clause the governor has actually written, oldest first. Real on-chain
          state, not a staged sequence.
        </p>
      </div>
      <div className="mt-8 h-px w-full bg-ink/15" />

      {clauses === null ? (
        <p className="mt-16 font-mono text-xs tracking-[0.2em] text-ink/45 uppercase">
          Reading genome…
        </p>
      ) : clauses.length === 0 ? (
        <p className="mt-16 max-w-sm text-sm text-ink/55">
          No clauses yet. The genome is empty until Helix's first consensus round writes
          one.
        </p>
      ) : (
        <div className="mt-12 grid gap-8 md:grid-cols-4">
          {clauses.map((c) => (
            <article key={c.clauseId}>
              <p className="font-mono text-xs text-ink/50">
                {c.clauseId.padStart(2, "0")}
              </p>
              <div className="mt-3 h-px w-full bg-ink/20" />
              <h2 className="mt-4 text-2xl tracking-tight text-ink">{c.family}</h2>
              <p className="mt-1 font-mono text-xs tracking-[0.15em] text-ink/50 uppercase">
                {c.patchId}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">{c.text}</p>
              {c.sourceUrl && (
                <p className="mt-2 truncate font-mono text-[11px] text-ink/40">
                  {c.sourceUrl}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
