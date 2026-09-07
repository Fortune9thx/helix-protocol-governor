import { createFileRoute } from "@tanstack/react-router";
import portrait from "@/assets/helix-portrait.jpg";
import { useHelix } from "@/lib/helix-state";

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

function Theater() {
  const { spliced } = useHelix();

  return (
    <div className="grid h-screen w-full grid-cols-1 overflow-hidden md:grid-cols-2">
      <section className="flex flex-col justify-center bg-sand px-8 pt-24 pb-10 md:px-14">
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
            disabled={spliced}
            className="inline-flex min-w-[12rem] items-center justify-center whitespace-nowrap rounded-full bg-ink px-8 py-4 text-base tracking-tight text-cream transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            {spliced ? "Frozen by Helix" : "Approve 100 ETH"}
          </button>
          <p className="mt-4 font-mono text-xs tracking-wide text-ink/55 uppercase">
            HostVault {spliced ? "V2" : "V1"} · Unlimited approvals allowed.
          </p>
        </div>
      </section>

      <section className="relative hidden bg-ink md:block">
        <img
          src={portrait}
          alt="Dithered portrait of the governed patient"
          width={1024}
          height={1280}
          className="h-full w-full object-cover opacity-90"
        />
        <div className="absolute inset-0 p-10 pt-28">
          <div className="flex flex-col items-start gap-5">
            <span className="font-mono text-xs tracking-[0.25em] text-bone/85 uppercase">
              {spliced ? "PATIENT DEAD" : "PATIENT LIVE"}
            </span>
            <div className="flex items-center gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={
                    "h-2 w-2 rounded-[1px] " + (i < 4 ? "bg-bone" : "bg-bone/25")
                  }
                />
              ))}
              <span className="ml-3 font-mono text-xs tracking-[0.2em] text-bone/60">4 / 5</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
