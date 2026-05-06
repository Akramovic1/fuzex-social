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
- HTTP integration tests use `buildAppHarness()` which spins up a real ephemeral http server bound to the test DB. supertest drives it with a real socket. This catches issues that fetch-handler-only tests would miss (e.g., header parsing edge cases)
- `/health` returns 200 even when the DB is down (`status: "degraded"`). 5xx is reserved for cases where the process should be removed from a load balancer pool. Add `/health/ready` later if pm2/k8s probes need a hard gate
- Reading `package.json` from a route uses `fs.readFileSync(path.resolve(process.cwd(), 'package.json'))`, NOT `createRequire(import.meta.url)`. The latter looks correct for ESM but breaks under ts-jest's CJS compilation (`tsconfig.test.json` has `module: CommonJS`, which rejects `import.meta`). The fs approach works under both module systems and assumes scripts run from the `api/` directory (true for `tsx`, `jest`, and `node dist/index.js`)
- App factory uses dependency injection: `buildApp({ db })` rather than reaching for a singleton. Production passes `getDb()`, tests pass a test-DB-bound `Database`. Same pattern for module factories (`buildApiSocialModule({ db })`) and route factories (`buildHealthRoutes({ db })`)
- Routes never throw raw `Error` — they throw an `AppError` subclass (`HandleResolutionError`, `ValidationError`, etc.) so the global error handler can format consistently
- The well-known endpoint returns 404 with EMPTY body for ALL resolution failures (malformed handle, not found, reserved name). This avoids leaking which usernames exist via differential responses
- Reserved usernames must NEVER be removed from the list — only added. A removed reserved name could be claimed by a malicious user who anticipated the removal
- Reserved username check happens BEFORE the DB query in `UserResolver`. Defense in depth: the DB never sees a query for "admin"
- The resolve endpoint runs zod validation on its OWN response shape before returning. Cheap insurance: catches drift between the schema and actual data
- Jest is set to `maxWorkers: 1` so test files run sequentially. They share the `fuzex_social_test` DB and use `truncateAll` between tests; cross-file parallelism would create race conditions. Tradeoff: tests run a few hundred ms slower but are deterministic

## Database layer

- Migrations are HAND-WRITTEN in `api/src/shared/db/migrations/*.sql`. We do not use `drizzle-kit generate`. The journal at `migrations/meta/_journal.json` tracks applied migrations
- Drizzle's migrator splits SQL files on the literal token `--> statement-breakpoint`. Statements without it run as a single block — usually fine, but explicit breakpoints make failures easier to diagnose
- The `audit_logs.user_id` foreign key is declared in SQL only, not in the Drizzle `pgTable` definition. The `relations()` helper for query-builder convenience is separate from the FK constraint
- Tests use a SEPARATE database `fuzex_social_test` on the same Postgres instance. Jest's `globalSetup` auto-creates it if missing (requires the dev DB user to have `CREATEDB`)
- Repositories take `Database` via constructor — they don't import the singleton — so tests can pass a test DB
- Jest `globalSetup` is loaded by Node's plain CJS loader, NOT by Jest's runtime. That loader bypasses both `moduleNameMapper` and the `.js → no-extension` rewrite. The setup file therefore imports only from `node_modules` (drizzle, pg) and inlines the migration runner — anything from `src/` would crash
- The Postgres container in dev was bootstrapped with `POSTGRES_USER=fuzex_api_dev`, making that user the bootstrap superuser (no `postgres` role exists). Use `-U fuzex_api_dev` for admin tasks like `ALTER USER ... CREATEDB`

## Coverage tracker

Current temporary exclusions (must be re-included as their tests land):

- `src/index.ts`                — keep excluded (bootstrap)
- `src/shared/config/**`        — re-include in Prompt 6 (deployment harness will exercise config validation)
- `src/shared/logger/**`        — keep excluded (logger config, side-effect heavy)
- `src/shared/middleware/errorHandler.ts` — re-include in Prompt 6 once another error-throwing path exists in addition to HandleResolutionError
- `src/shared/db/index.ts`      — keep excluded (singleton)
- `src/shared/db/migrationRunner.ts` — re-include if pure logic gains tests
- `src/**/index.ts`             — keep excluded (barrel files)

Re-included in Prompt 4:
- `src/app.ts`                  ✅
- `src/shared/middleware/**` (except errorHandler) ✅

Re-included in Prompt 5:
- `src/shared/errors/**`        ✅ (HandleResolutionError exercised by route tests at 100%; AppError at 100%; unused subclasses NotFound/Internal/Unauthorized/Validation at 50%)

Threshold stays at 70% on all metrics.

## Known Limitations

- **lint-staged scope**: The pre-commit hook runs `cd api && npx lint-staged`, which scopes file matching to the api/ package. Root-level files (CHANGELOG.md, README.md, root configs) are not formatted by lint-staged on commit. Source code in api/ is fully linted as expected. Tracked for future resolution — likely requires either a root package.json with workspaces or duplicating lint-staged config at the root.
