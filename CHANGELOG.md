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

### Changed
- Moved Husky hooks to repo root (idiomatic Husky v9 layout); `prepare` script updated from `husky install api/.husky` (deprecated) to `husky`
- Removed Husky v8 deprecation idiom from hooks (clean v9 layout)
- Jest coverage exclusions tightened: `app.ts` and `middleware/**` (except errorHandler) are now measured
