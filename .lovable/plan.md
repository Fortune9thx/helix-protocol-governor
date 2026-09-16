# HELIX Monochrome System Rebuild

## Goal
Rebuild the existing three-view HELIX interface in the selected monochrome system-blueprint direction, using the attached HAVU references only as a visual system.

## What will change
- Replace the floating cream pill navigation with a full-width black top bar, custom 1-bit H mark, route navigation, network status, and wallet control.
- Rework Theater into a near-viewport command surface with the oversized HELIX wordmark, live/dead pixel sprite, approval action, three numbered status columns, and moving bottom ticker.
- Rework Dossier into an alarm workflow with two underline inputs, ingest action, pixel pending state, four-step progress, and a compact result row including ALREADY LAW handling.
- Rework Genome into a ruled numbered log with clause metadata and a pixel-art empty state.
- Rename the preview control to DEMO STATE and anchor it unobtrusively in the corner.
- Replace the sand/cream/photo styling with semantic black, off-white, gray-rule, and yellow-white status tokens.

## Motion and accessibility
- Add continuous status ticker movement, network pulse, 200ms state glitch, numeric tick, and left-to-right pending action fill.
- Respect reduced-motion preferences by removing glitches and fills while retaining a slow ticker.

## Technical details
- Preserve existing wallet and GenLayer contract calls.
- Use custom CSS/inline SVG pixel sprites only; no icon library or photographic assets.
- Keep the existing `/`, `/dossier`, and `/log` routes and route-specific metadata.
- Verify desktop and mobile layouts, route rendering, interactions, and build health.
