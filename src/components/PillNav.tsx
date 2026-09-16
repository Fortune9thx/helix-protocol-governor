import { Link } from "@tanstack/react-router";
import { truncate } from "../lib/genlayer";
import { useHelixWallet } from "../lib/wallet";
import { Button } from "./ui/button";
import { HelixMark } from "./PixelGlyph";

const items = [
  { to: "/", label: "Theater" },
  { to: "/dossier", label: "Dossier" },
  { to: "/log", label: "Log" },
] as const;

export function PillNav() {
  const { address, connecting, clientError, openConnectModal } = useHelixWallet();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-background">
      <nav className="mx-auto flex h-16 w-full items-center justify-between px-5 md:px-10" aria-label="Primary navigation">
        <div className="flex items-center gap-6 md:gap-12">
          <Link to="/" className="flex items-center gap-2 text-foreground" aria-label="HELIX home">
            <HelixMark className="h-5 w-5" />
            <span className="text-sm font-bold">HELIX</span>
          </Link>
          <div className="flex items-center gap-4 md:gap-7">
            {items.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                activeOptions={{ exact: i.to === "/" }}
                className="font-mono text-[10px] uppercase transition-colors md:text-xs"
                inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
                activeProps={{ className: "text-foreground" }}
              >
                {i.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-5">
          <span className="hidden items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase sm:flex">
            EN <span aria-hidden="true">·</span>
            <span className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5">
              <span className="network-pulse h-1.5 w-1.5 bg-foreground" />
              studio-dev 61997
            </span>
          </span>
            <Button
              type="button"
              onClick={() => openConnectModal?.()}
              disabled={connecting || address !== undefined || !openConnectModal}
              className="h-8 rounded-full bg-foreground px-4 font-mono text-[10px] text-background uppercase hover:bg-foreground/85"
            >
              {address ? truncate(address) : connecting ? "Connecting" : "Connect"}
            </Button>
        </div>
      </nav>
        {clientError && (
          <p className="absolute right-5 top-20 max-w-xs border border-line bg-background px-4 py-2 text-right font-mono text-xs text-muted-foreground">
            {clientError}
          </p>
        )}
    </header>
  );
}
