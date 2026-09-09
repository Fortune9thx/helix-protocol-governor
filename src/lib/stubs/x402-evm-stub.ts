// Stub for the optional @x402/evm package.
//
// wagmi's default connector set (via RainbowKit's getDefaultConfig) pulls
// in Coinbase's Base Account connector, whose SDK (@coinbase/cdp-sdk)
// imports @x402/evm for an x402-payments account-signer feature this app
// never uses. That real package fails to resolve its named export here
// (rolldown/Vite's production build, not just a dev-time warning -
// `[MISSING_EXPORT] "toClientEvmSigner" is not exported by
// "__vite-optional-peer-dep:@x402/evm:@coinbase/cdp-sdk"`), which is the
// production-build equivalent of the same "optional connector dependency
// Vite/webpack can't resolve and doesn't need to" class of issue
// documented for Next.js/webpack elsewhere. Aliased in vite.config.ts so
// the import resolves to this harmless stub instead of failing the build;
// the real function is never called because this app never uses Coinbase's
// x402 payment flow.
export function toClientEvmSigner(): never {
  throw new Error("x402 payments are not used by this app (stubbed @x402/evm import).");
}
