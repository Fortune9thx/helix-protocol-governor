// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    build: {
      rollupOptions: {
        // wagmi's default connectors transitively pull in @coinbase/cdp-sdk's
        // x402-payments feature (Base Account connector), which lazily
        // dynamic-imports several @x402/* subpaths (@x402/evm,
        // @x402/evm/upto/client, ...) this app never actually calls. An
        // alias to a stub only covers one exact specifier; @x402/* has
        // multiple subpath exports, so mark the whole scope external
        // instead - rolldown then leaves the dynamic import as-is rather
        // than trying to resolve/bundle a package tree that isn't fully
        // installed. Harmless: the x402 code path is never reached.
        external: [/^@x402\//],
      },
    },
  },
});
