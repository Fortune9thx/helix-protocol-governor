type PixelGlyphProps = {
  kind?: "live" | "dead" | "empty" | "spinner";
  className?: string;
};

export function PixelGlyph({ kind = "live", className = "" }: PixelGlyphProps) {
  if (kind === "dead") {
    return (
      <svg viewBox="0 0 18 16" aria-hidden="true" className={className} shapeRendering="crispEdges">
        <path fill="currentColor" d="M4 1h3v2h2v2h2V3h3v2h2v7h-2v2h-3v-2H7v2H4v-2H2V5h2V1Zm2 5v2h2V6H6Zm4 2h2V6h-2v2Z" />
        <path fill="currentColor" d="M0 8h2v3H0V8Zm16 0h2v3h-2V8ZM5 15h3v1H5v-1Zm5 0h3v1h-3v-1Z" />
      </svg>
    );
  }

  if (kind === "empty") {
    return (
      <svg viewBox="0 0 18 16" aria-hidden="true" className={className} shapeRendering="crispEdges">
        <path fill="currentColor" d="M6 1h6v2h2v2h2v7h-3v3h-2v-3H7v3H5v-3H2V5h2V3h2V1Zm0 5v2h2V6H6Zm4 0v2h2V6h-2Zm-3 4v1h4v-1H7Z" />
      </svg>
    );
  }

  if (kind === "spinner") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true" className={className} shapeRendering="crispEdges">
        <path fill="currentColor" d="M6 0h4v2H6V0Zm4 2h3v2h-3V2Zm3 2h2v4h-2V4Zm0 6h-2v2h2v-2Zm-3 2H6v2h4v-2Zm-6-2H2v2h2v-2ZM0 6h2v4H0V6Zm2-2h2v2H2V4Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 18 16" aria-hidden="true" className={className} shapeRendering="crispEdges">
      <path fill="currentColor" d="M5 1h3v2h2V1h3v2h2v2h2v7h-3v3h-3v-3H7v3H4v-3H1V5h2V3h2V1Zm1 5v2h2V6H6Zm4 0v2h2V6h-2Z" />
      <path fill="currentColor" d="M0 7h2v3H0V7Zm16 0h2v3h-2V7Z" />
    </svg>
  );
}

export function HelixMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className} shapeRendering="crispEdges">
      <path fill="currentColor" d="M2 2h4v6h8V2h4v16h-4v-6H6v6H2V2Zm6 7h4v2H8V9Z" />
    </svg>
  );
}