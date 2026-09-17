import type { JuryTally } from "../lib/helix-contracts";

type JuryDotsProps = {
  tally: JuryTally | null;
  className?: string;
};

/**
 * The real per-round validator vote tally from the last finalized write this
 * session observed (raise_alarm or approve) - lit squares are AGREE votes,
 * hollow squares are the rest of that round's validator set. Never a fake
 * default: renders "NO JURY YET" until a real receipt has actually supplied
 * one, and never invents a 5-validator round if the chain reported fewer.
 */
export function JuryDots({ tally, className = "" }: JuryDotsProps) {
  if (!tally || tally.total === 0) {
    return (
      <p className={`font-mono text-[9px] text-muted-foreground uppercase ${className}`}>
        NO JURY YET
      </p>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex gap-1.5" role="img" aria-label={`${tally.agree} of ${tally.total} validators agreed`}>
        {Array.from({ length: tally.total }, (_, i) => (
          <span
            key={i}
            className={i < tally.agree ? "h-2 w-2 bg-foreground" : "h-2 w-2 border border-line"}
          />
        ))}
      </div>
      <p className="font-mono text-[9px] text-muted-foreground uppercase">
        LAST JURY {tally.agree}/{tally.total} AGREE
      </p>
    </div>
  );
}
