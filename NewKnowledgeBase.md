# New Knowledge Base

Things learned about this codebase that future contributors should know.
Add new entries as you discover non-obvious behaviors. If an entry is encountered
multiple times, append `xN` instead of duplicating.

## Conventions

- Local Postgres dev runs in Docker on host port **5433** (not 5432) to avoid conflicts with other Postgres instances on the dev machine
- pm2 config files use `.cjs` extension because pm2 requires CommonJS
- All paths use `@/` alias mapped to `api/src/`

## Tooling

- TypeScript strict mode is non-negotiable; do not loosen `tsconfig.json`
- ESLint runs in `--ext .ts` mode; JS files are not allowed in `src/`
- Husky hooks are installed via `npm run prepare` from the `api/` directory
- Jest uses `tsconfig.test.json` (not `tsconfig.json`) — overrides `module` to `CommonJS` because `package.json` has `"type": "module"` and `tsconfig.json` uses `module: NodeNext`. Without this override, ts-jest emits ESM imports which Jest's CJS runtime can't execute
- `jest.config.cjs` has a `moduleNameMapper` rule `^(\.{1,2}/.*)\.js$ → $1` that strips `.js` extensions from relative imports during testing, since ts-jest in CJS mode can't resolve the ESM-style `.js` specifiers we use in source

## Code patterns

- ESM imports of TS files MUST use `.js` extension in the import specifier (Node ESM requirement, even though we author `.ts`)
- The path alias `@/` resolves to `api/src/`. Use it for cross-directory imports; use `./` for same-directory imports
- Never read `process.env` outside `src/shared/config/env.ts`. Import the typed `config` object from `@/shared/config/index.js` instead
- Never use `console.*`. Use the pino logger from `@/shared/logger/index.js`
- Errors thrown from route handlers must extend `AppError` from `@/shared/errors/index.js` — anything else becomes a 500 with no detail leaked to the client
- Hono middleware order matters: correlationId → CORS → requestLogger → rateLimit → routes

## Database layer

- Migrations are HAND-WRITTEN in `api/src/shared/db/migrations/*.sql`. We do not use `drizzle-kit generate`. The journal at `migrations/meta/_journal.json` tracks applied migrations
- Drizzle's migrator splits SQL files on the literal token `--> statement-breakpoint`. Statements without it run as a single block — usually fine, but explicit breakpoints make failures easier to diagnose
- The `audit_logs.user_id` foreign key is declared in SQL only, not in the Drizzle `pgTable` definition. The `relations()` helper for query-builder convenience is separate from the FK constraint
- Tests use a SEPARATE database `fuzex_social_test` on the same Postgres instance. Jest's `globalSetup` auto-creates it if missing (requires the dev DB user to have `CREATEDB`)
- Repositories take `Database` via constructor — they don't import the singleton — so tests can pass a test DB
- Jest `globalSetup` is loaded by Node's plain CJS loader, NOT by Jest's runtime. That loader bypasses both `moduleNameMapper` and the `.js → no-extension` rewrite. The setup file therefore imports only from `node_modules` (drizzle, pg) and inlines the migration runner — anything from `src/` would crash
- The Postgres container in dev was bootstrapped with `POSTGRES_USER=fuzex_api_dev`, making that user the bootstrap superuser (no `postgres` role exists). Use `-U fuzex_api_dev` for admin tasks like `ALTER USER ... CREATEDB`

## Coverage tracker

Coverage exclusions added in Prompt 3 (must be re-included as their test coverage lands):

- `src/app.ts`                  — re-include in Prompt 4 (HTTP tests via supertest)
- `src/index.ts`                — keep excluded (bootstrap, hard to unit-test)
- `src/shared/middleware/**`    — re-include in Prompt 4 (tests exercise via app)
- `src/shared/errors/**`        — re-include in Prompt 4 (error handler tests)
- `src/shared/config/**`        — re-include in Prompt 5 (route-level integration)
- `src/shared/logger/**`        — keep excluded (logger config, side-effect heavy)
- `src/shared/db/index.ts`      — keep excluded (singleton, tested via integration)
- `src/shared/db/migrationRunner.ts` — re-include if pure logic gains tests

When re-including, expect coverage to drop initially, then rise as new tests land. Threshold stays at 70%.

## Known Limitations

- **lint-staged scope**: The pre-commit hook runs `cd api && npx lint-staged`, which scopes file matching to the api/ package. Root-level files (CHANGELOG.md, README.md, root configs) are not formatted by lint-staged on commit. Source code in api/ is fully linted as expected. Tracked for future resolution — likely requires either a root package.json with workspaces or duplicating lint-staged config at the root.
