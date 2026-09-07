import { Link } from "@tanstack/react-router";
import { truncate } from "../lib/genlayer";
import { useWallet } from "../lib/wallet";

const items = [
  { to: "/", label: "Theater" },
  { to: "/dossier", label: "Dossier" },
  { to: "/log", label: "Log" },
] as const;

export function PillNav() {
  const { address, connecting, connect } = useWallet();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-5">
      <nav className="pointer-events-auto flex w-full max-w-3xl items-center justify-between rounded-full border border-ink/10 bg-cream/85 px-2 py-2 backdrop-blur-md">
        <div className="flex items-center gap-1">
          {items.map((i) => (
            <Link
              key={i.to}
              to={i.to}
              activeOptions={{ exact: i.to === "/" }}
              className="rounded-full px-5 py-2 text-sm tracking-tight transition-colors"
              inactiveProps={{ className: "text-ink/60 hover:text-ink" }}
              activeProps={{ className: "bg-ink text-cream" }}
            >
              {i.label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void connect()}
          disabled={connecting || address !== null}
          className="rounded-full bg-ink px-5 py-2 text-sm tracking-tight text-cream transition-opacity hover:opacity-85"
        >
          {address ? truncate(address) : connecting ? "Connecting" : "Connect"}
        </button>
      </nav>
    </div>
  );
}
