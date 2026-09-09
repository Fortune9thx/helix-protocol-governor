import { Link } from "@tanstack/react-router";
import { truncate } from "../lib/genlayer";
import { useHelixWallet } from "../lib/wallet";

const items = [
  { to: "/", label: "Theater" },
  { to: "/dossier", label: "Dossier" },
  { to: "/log", label: "Log" },
] as const;

export function PillNav() {
  const { address, connecting, clientError, openConnectModal } = useHelixWallet();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-5">
      <div className="pointer-events-auto flex w-full max-w-3xl flex-col items-end gap-2">
        <nav className="flex w-full items-center justify-between rounded-full border border-ink/10 bg-cream/85 px-2 py-2 backdrop-blur-md">
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
          <div className="flex items-center gap-4">
            <img src="/logo.svg" alt="HELIX" className="h-4 w-auto" />
            <button
              type="button"
              onClick={() => openConnectModal?.()}
              disabled={connecting || address !== undefined || !openConnectModal}
              className="rounded-full bg-ink px-5 py-2 text-sm tracking-tight text-cream transition-opacity hover:opacity-85"
            >
              {address ? truncate(address) : connecting ? "Connecting" : "Connect"}
            </button>
          </div>
        </nav>
        {clientError && (
          <p className="mr-2 max-w-xs rounded-2xl border border-ink/10 bg-cream/95 px-4 py-2 text-right font-mono text-xs text-ink/75 shadow-sm backdrop-blur-md">
            {clientError}
          </p>
        )}
      </div>
    </div>
  );
}
