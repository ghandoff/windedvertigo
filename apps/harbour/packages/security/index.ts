// Re-exports for @windedvertigo/security.
//
// Today this package only exposes the CF Workers header wrapper. As more
// shared security primitives land (e.g. CSP nonce helpers, callback-URL
// allowlist validators), they should be re-exported here so consumers
// import everything from `@windedvertigo/security` without reaching into
// subpaths.
export {
  wrapWithSecurityHeaders,
  HARBOUR_DEFAULT_CSP,
  type SecurityHeadersOptions,
  type WorkerHandler,
} from "./cf-headers";
