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

### Changed
- Moved Husky hooks to repo root (idiomatic Husky v9 layout); `prepare` script updated from `husky install api/.husky` (deprecated) to `husky`
- Removed Husky v8 deprecation idiom from hooks (clean v9 layout)
