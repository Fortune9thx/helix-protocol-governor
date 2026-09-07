import { createFileRoute } from "@tanstack/react-router";
import f1 from "@/assets/frame-01.jpg";
import f2 from "@/assets/frame-02.jpg";
import f3 from "@/assets/frame-03.jpg";
import f4 from "@/assets/frame-04.jpg";

export const Route = createFileRoute("/log")({
  head: () => ({
    meta: [
      { title: "HELIX — Genome | Vault mutation log" },
      {
        name: "description",
        content: "The HELIX genome log: V1 live, ingest, jury 4/5, V2 spliced.",
      },
      { property: "og:title", content: "HELIX — Genome" },
      {
        property: "og:description",
        content: "The HELIX genome log: V1 live, ingest, jury 4/5, V2 spliced.",
      },
    ],
  }),
  component: Log,
});

const frames = [
  { n: "01", title: "V1 live", img: f1, note: "HostVault V1 holds custody. Unlimited allowance open." },
  { n: "02", title: "Ingest", img: f2, note: "Threat and evidence sources pulled into the dossier." },
  { n: "03", title: "Jury 4/5", img: f3, note: "Four of five equivalent marks returned should_act." },
  { n: "04", title: "V2 spliced", img: f4, note: "Patch applied. Approval path frozen, V2 governs." },
];

function Log() {
  return (
    <main className="min-h-screen bg-cream px-8 pt-32 pb-24 md:px-14">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
        <h1 className="text-[16vw] leading-[0.84] text-ink md:text-[8vw]">Genome</h1>
        <p className="max-w-sm text-sm text-ink/65 md:mt-6">
          Sequence of vault states recorded by the governor, oldest first.
        </p>
      </div>
      <div className="mt-8 h-px w-full bg-ink/15" />

      <div className="mt-12 grid gap-8 md:grid-cols-4">
        {frames.map((f) => (
          <article key={f.n}>
            <img
              src={f.img}
              alt={`Dithered still for stage ${f.n}, ${f.title}`}
              width={768}
              height={768}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
            <p className="mt-5 font-mono text-xs text-ink/50">{f.n}</p>
            <div className="mt-3 h-px w-full bg-ink/20" />
            <h2 className="mt-4 text-2xl tracking-tight text-ink">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/65">{f.note}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
