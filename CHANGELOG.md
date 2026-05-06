# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

### Changed
- Moved Husky hooks to repo root (idiomatic Husky v9 layout); `prepare` script updated from `husky install api/.husky` (deprecated) to `husky`
- Removed Husky v8 deprecation idiom from hooks (clean v9 layout)
- Jest coverage exclusions tightened: `app.ts` and `middleware/**` (except errorHandler) are now measured

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
