# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **E2E test suite** (`tests/e2e/`) — separate `@fuzex/e2e` package using vitest
  2.x + firebase-admin 12.x + plain `fetch`. Hits the **live dev backend**
  (`https://dev-api.fuzex.social`) — no mocking. 28 tests across three layers:
  Layer 1 smoke (12 tests, public endpoints), Layer 2 authenticated (8 tests,
  real Firebase ID tokens via custom-token-then-exchange), Layer 3 lifecycle
  (8 sequential steps, creates a real PDS account end-to-end). Auto-cleans
  Firebase Auth + Firestore; prints manual VPS cleanup commands for the
  Postgres + PDS sqlite rows it leaves behind. Sequential execution
  (`fileParallelism: false`, `singleFork: true`) since Layer 3 has shared
  cross-step state. See `tests/e2e/README.md`.

## 2026-05-06 — Domain migration follow-ups

### Fixed
- **Caddy TLS for PDS hostname**: `pds.dev.fuzex.social` and `*.dev.fuzex.social`
  were initially configured as separate blocks. Caddy's policy resolver
  silently broke proactive cert obtain when a managed-cert sibling block and
  a wildcard block matched the same hostname, causing TLS handshakes to fall
  through to on-demand and fail. Combined them into a single on-demand-TLS
  block gated by PDS `/tls-check` (matching Bluesky's bsky.social reference
  pattern). Now eager managed cert is reserved for `dev-api.fuzex.social`
  only; the PDS hostname rides on the wildcard's on-demand cert acquisition.

### Notes
- VPS migration to `fuzex.social` completed end-to-end. All 5 endpoints
  verified green: `/health`, `/v1/username/check`, `/v1/resolve/:handle`,
  `/.well-known/atproto-did`, and `POST /v1/atproto/getSession`.
- Dev test user: `t100.dev.fuzex.social` (DID `did:plc:4nohhpere4ka5gisniie6nxh`).
- `infrastructure/caddy/Caddyfile.dev` updated to the working pattern. Old
  versions are preserved on the VPS as
  `/pds/caddy/etc/caddy/Caddyfile.before-bsky-pattern-*`.
- Discovered and fixed a placeholder string left in `/opt/fuzex-social/api/.env`
  (`PDS_ADMIN_PASSWORD=PASTE_FROM_PDS_ADMIN_PWD_VARIABLE_HERE`) that was
  blocking `createAccount` calls with PDS 401. Now correctly synced from
  `/pds/pds.env`.
- Resend domain `email.fuzex.social` verified end-to-end via direct SMTP
  (port 587 / STARTTLS — confirmed via swaks; email arrived). Bluesky PDS's
  email module silently no-ops when configured to use anything other than
  port 465; Hetzner blocks 465. Marked as known limitation. PDS email is
  not required for migration verification or mobile integration. Production
  email flows will go through Resend HTTP API directly from fuzex-api
  (port 443, never blocked).
- Cleaned up an orphan PDS sqlite row (`did:plc:ztvbl26f45oauegzdb7l7f7o`,
  email `akram@fuzex.io`) left over from an earlier failed `createAccount`
  call (succeeded at PDS step, failed at fuzex-api downstream due to the
  PDS_ADMIN_PASSWORD placeholder bug). Documented detection + cleanup
  procedure in NewKnowledgeBase.


### Changed
- (Domain migration) All fuzex-api and PDS hostnames moved from `fuzex.app`
  to `fuzex.social`. fuzex-api now lives at `dev-api.fuzex.social` (dev),
  `api.fuzex.social` (prod). PDS at `pds.dev.fuzex.social` (dev),
  `pds.fuzex.social` (prod). User handles are `username.dev.fuzex.social`
  (dev), `username.fuzex.social` (prod). See ADR 0007.
- (Domain migration) Synthetic email for phone-only signups now uses
  `email.fuzex.social` instead of `email.fuzex.app`.
- (Domain migration) Caddyfile.dev updated to serve fuzex.social hostnames
  and remove fuzex.app social routing.

### Deprecated
- `dev-api.fuzex.app`, `pds.dev.fuzex.app`, `*.dev.fuzex.app` — replaced
  by `.fuzex.social` equivalents. Will be removed from DNS after a 7-14
  day transition window.

### Added (Phase 2)
- `firebase-admin` SDK integration for ID-token verification + Firestore reads
- Firebase auth middleware (`createFirebaseAuthMiddleware`) verifying Bearer tokens via `verifyIdToken`
- `FirestoreUserService` reading `Users/{firebase_uid}` with retry on missing doc and zod validation
- `PdsAdminClient` wrapping `createInviteCode`, `createAccount`, `createSession`, `putProfile` XRPC endpoints
- AES-256-GCM encryption utility (`@/shared/utils/encryption.ts`) for at-rest PDS password storage
- `BadRequestError`, `ConflictError`, `UnprocessableEntityError` AppError subclasses
- `AuditLogsRepository` with `create({ action, success, metadata, correlationId })` matching the existing schema
- `UsersRepository.createWithProfile()` and supporting Phase 2 fields
- `CreateAccountService` orchestrating the full signup flow: idempotency → Firestore → age check → username uniqueness → invite → PDS account → profile write → DB insert → audit log
- `GetSessionService` issuing fresh PDS sessions for existing users via decrypted password
- `POST /v1/atproto/createAccount` endpoint (Firebase-authenticated, returns DID + handle)
- `POST /v1/atproto/getSession` endpoint (Firebase-authenticated, returns access + refresh JWTs)
- `GET /v1/username/check` endpoint with discriminated reasons (`TOO_SHORT`, `RESERVED`, `ALREADY_TAKEN`, etc.)
- Migration `0001_phase2_user_fields.sql` adding profile columns + encrypted password to `users`
- 50 new tests across encryption, firebase auth middleware, syntheticEmail, pdsAdminClient (mock-fetch), firestoreUserService (fake firestore), createAccountService (real test DB + mocks), getSessionService, username route, atproto route auth gate
- Coverage exclusion for `src/shared/firebase/**` (production singleton; documented in NewKnowledgeBase)
- 3 new ADRs: `0004` (synthetic email), `0005` (Firestore as profile SoT), `0006` (encrypted PDS passwords)
- `docs/integration-with-mobile.md` — concrete Flutter signup flow guide

### Added (Phase 1)
- Initial monorepo scaffold
- TypeScript + Hono + Drizzle tooling configuration
- ESLint, Prettier, Husky, lint-staged, commitlint setup
- Jest test runner configuration
- Editor and Node version configs (.editorconfig, .nvmrc)
- Shared infrastructure: typed config (zod-validated), pino logger with redaction, error class hierarchy, correlation ID + request logging + error handler + in-memory rate limit middleware
- Hono app factory (`src/app.ts`)
- Server bootstrap with graceful shutdown (`src/index.ts`)
- Handle parser utility with full unit-test coverage
- `eslint-import-resolver-typescript` dev dependency (required for `import/*` rules to resolve TypeScript paths)
- `tsconfig.test.json` — test-only tsconfig with `module: CommonJS` so ts-jest produces Jest-compatible output
- Database layer: Drizzle schema (users, audit_logs, invite_codes), pooled pg client, hand-written initial migration
- Migration runner (CLI + library) with shared core for tests
- UsersRepository with full integration test coverage (5 query methods, 8 cases)
- Database health check helper (`pingDatabase`) with integration test
- Test DB harness: auto-creates `fuzex_social_test`, runs migrations in jest globalSetup
- Graceful shutdown now closes the DB pool
- api-social module skeleton with dependency-injection pattern
- GET /health endpoint with DB ping (200 ok / 200 degraded — never 5xx for transient DB blips)
- HTTP integration test infrastructure (appHarness + supertest)
- 4 integration tests covering /health happy path, X-Request-Id propagation, rate-limit headers
- app.ts refactored to accept AppDependencies via factory (inversion of control)
- GET /.well-known/atproto-did endpoint (Postgres-backed handle resolution; replaces temporary Caddy hardcode)
- GET /v1/resolve/:handle endpoint (public tipping resolver with cache headers)
- UserResolver service composing UsersRepository with handle parsing/validation
- handleValidation lib (length, charset, hyphen, all-digit rules) with full unit-test coverage
- reservedUsernames lib with the locked-in reserved list and regex patterns
- HandleResolutionError typed error class with USER_NOT_FOUND / INVALID_HANDLE / TIPPING_DISABLED variants
- zod response schemas (resolveHandleResponseSchema, errorResponseSchema) used in route tests
- scripts/seed-akram.sql for end-to-end verification
- Coverage exclusion for errors/** removed — error handler now exercised by route tests
- Production Caddyfile replacing the temporary akram hardcode (routes /.well-known/atproto-did to fuzex-api for any *.dev.fuzex.app handle)
- Idempotent VPS bootstrap script (scripts/setup-vps.sh) — Node 20, pm2, Postgres 16, deploy key, app dir
- Idempotent deploy script (scripts/deploy.sh) — git pull, npm ci, build, migrate, pm2 reload, smoke test
- Postgres init.sql for one-time DB user/database creation
- Architecture documentation (docs/architecture.md)
- Deployment guide (docs/deployment.md)
- Operations runbook (docs/operations.md)
- API reference (docs/api-reference.md)
- ADRs: 0001 (Postgres on VPS), 0002 (No Redis Phase 1), 0003 (Firestore untouched)
- docs/local-dev-setup.md — onboarding guide for local development
- docs/production-vps-setup.md — prescriptive playbook for provisioning a production VPS with hardening (dedicated user, automated backups, monitoring, stricter rate limits)
- docs/vps-dev-setup-history.md — narrative account of the dev VPS provisioning, including dead ends and lessons learned
- README.md "Getting started" table linking to all major docs by audience
- docs/README.md doc index

### Fixed
- (Phase 1 deployment) `tsc-alias` post-build step rewrites `@/` path aliases in compiled JavaScript. Without it, `node dist/index.js` errors with `ERR_MODULE_NOT_FOUND: Cannot find package '@/shared'` because `tsc` itself does not rewrite paths.
- (Phase 1 deployment) fuzex-api moved from `api.dev.fuzex.app` to `dev-api.fuzex.app` to avoid Caddy TLS policy collision with the `*.dev.fuzex.app` wildcard on-demand policy. Sibling subdomain pattern allows Caddy to manage the cert directly via Let's Encrypt without PDS `/tls-check` involvement.
- (Phase 2 deployment) `scripts/deploy.sh`: changed `npm ci --omit=optional` to plain `npm ci`. The `--omit=optional` flag was stripping `firebase-admin`'s transitive `@google-cloud/firestore` submodules, causing a runtime crash with `Cannot find module '@google-cloud/firestore/build/src/path'` when Firestore was imported. Discovered during the first Phase 2 deploy.
- (Phase 2 deployment, NewKnowledgeBase) Documented that `pm2 reload` reuses the running Node process and may not pick up newly installed `node_modules`; for dependency changes, use `pm2 restart fuzex-api` (full process replacement).
- (Username validation) `GET /v1/username/check` and `POST /v1/atproto/createAccount` no longer silently lowercase user input. Uppercase letters now produce a clear `UPPERCASE_NOT_ALLOWED` validation reason and the response echoes the user's original input back unmutated. atproto handles remain case-insensitive at the DB level — the validator just refuses to do the lowercasing FOR the caller.

### Changed
- Moved Husky hooks to repo root (idiomatic Husky v9 layout); `prepare` script updated from `husky install api/.husky` (deprecated) to `husky`
- Removed Husky v8 deprecation idiom from hooks (clean v9 layout)
- Jest coverage exclusions tightened: `app.ts` and `middleware/**` (except errorHandler) are now measured
- `infrastructure/caddy/Caddyfile.dev` no longer routes `api.dev.fuzex.app`. New routing: `dev-api.fuzex.app` for the API (managed TLS), `pds.dev.fuzex.app` for the PDS (on-demand TLS), `*.dev.fuzex.app` for user handles only.
- All documentation references updated from `api.dev.fuzex.app` → `dev-api.fuzex.app`.

## [0.1.0] — Phase 1 Complete

### Summary

Phase 1 of fuzex-api is complete. The repository scaffolds a production-grade
TypeScript Hono backend with:

- 3 endpoints (`/health`, `/.well-known/atproto-did`, `/v1/resolve/:handle`)
- Industrial-standard tooling (TypeScript strict, ESLint, Prettier, Husky, Jest)
- 90 passing tests (unit + integration with real Postgres)
- Drizzle ORM with hand-written migrations
- pm2 ecosystem config
- Idempotent VPS setup and deploy scripts
- New Caddyfile that replaces the temporary akram hardcode
- Comprehensive docs (architecture, deployment, operations, API reference, ADRs)

Phase 2 will add authenticated endpoints (createAccount, getSession,
deleteAccount), Firebase Admin integration, and wallet signature verification.
