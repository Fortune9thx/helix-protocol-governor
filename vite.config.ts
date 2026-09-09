// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { resolve } from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        // See src/lib/stubs/x402-evm-stub.ts - wagmi's default connectors
        // transitively pull in an optional Coinbase x402 dependency that
        // fails to resolve in production builds; this app never uses it.
        // process.cwd() (not import.meta.url) because Vite may execute this
        // config from a transformed temp copy, whose own URL isn't a
        // reliable base for a relative path.
        "@x402/evm": resolve(process.cwd(), "src/lib/stubs/x402-evm-stub.ts"),
      },
    },
  },
});
