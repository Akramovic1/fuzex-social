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

## Deployment

- The deploy script does `git reset --hard origin/$BRANCH` — never `git pull` — to avoid surprise merge commits and to make rolling forward/back deterministic
- pm2 reload (not restart) achieves zero-downtime deploys when `instances > 1`. With instances: 1 it falls back to a fast restart, which is fine for our scale
- The smoke test polls `/health` for up to 15s after pm2 reload before declaring success. If the API can't bind in 15s, something else is wrong and the deploy should fail loudly
- Caddy reload (not restart) reloads the config without dropping connections. Use `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`
- Caddyfile changes are deployed by SCP'ing `infrastructure/caddy/Caddyfile.dev` to `/pds/caddy/etc/caddy/Caddyfile`, validating, then reloading. NEVER edit the file in place over SSH — too easy to mistype
- Postgres `init.sql` is idempotent — running on an already-set-up DB is a no-op
- The deploy SSH key is generated by `setup-vps.sh` and is READ-ONLY on GitHub. Production deploys never push

## Database layer

- Migrations are HAND-WRITTEN in `api/src/shared/db/migrations/*.sql`. We do not use `drizzle-kit generate`. The journal at `migrations/meta/_journal.json` tracks applied migrations
- Drizzle's migrator splits SQL files on the literal token `--> statement-breakpoint`. Statements without it run as a single block — usually fine, but explicit breakpoints make failures easier to diagnose
- The `audit_logs.user_id` foreign key is declared in SQL only, not in the Drizzle `pgTable` definition. The `relations()` helper for query-builder convenience is separate from the FK constraint
- Tests use a SEPARATE database `fuzex_social_test` on the same Postgres instance. Jest's `globalSetup` auto-creates it if missing (requires the dev DB user to have `CREATEDB`)
- Repositories take `Database` via constructor — they don't import the singleton — so tests can pass a test DB
- Jest `globalSetup` is loaded by Node's plain CJS loader, NOT by Jest's runtime. That loader bypasses both `moduleNameMapper` and the `.js → no-extension` rewrite. The setup file therefore imports only from `node_modules` (drizzle, pg) and inlines the migration runner — anything from `src/` would crash
- The Postgres container in dev was bootstrapped with `POSTGRES_USER=fuzex_api_dev`, making that user the bootstrap superuser (no `postgres` role exists). Use `-U fuzex_api_dev` for admin tasks like `ALTER USER ... CREATEDB`

## Phase 2: Firebase + Firestore + PDS admin

- `src/shared/firebase/firebaseAdmin.ts` is excluded from coverage. It's a singleton initializer that reads a real service account JSON file from `FIREBASE_SERVICE_ACCOUNT_PATH`. Mocking the file system + firebase-admin's internal `getApps()` to test it provides little value — the consumers (`firebaseAuth` middleware, `FirestoreUserService`) accept injectable dependencies and ARE tested with mocks. The singleton itself is exercised at production boot.

- `firebaseAuth` middleware uses dependency injection: `createFirebaseAuthMiddleware(authProvider = getFirebaseAuth)`. Tests pass a fake `Auth` object with a `jest.fn` `verifyIdToken`. The default points at the singleton, which only triggers init at request time — so unauthenticated requests return 401 BEFORE any Firebase call.

- `FirestoreUserService` accepts an optional `sleep` function so the retry tests don't actually wait 300/600/900ms. Production uses the real `setTimeout`-based sleep.

- The `users_must_have_email_or_phone` CHECK constraint was deliberately NOT added to the migration: the seeded `akram` row predates Phase 2 and has neither field set, so a CHECK would fail to apply. Application code (`createAccountService`) ensures every NEW row has at least one. If a future migration backfills the seed, that's the right time to add the constraint.

- `z.coerce.boolean()` is broken for strings — `Boolean('false')` is `true`. Use a custom transform (`z.string().transform((v) => v.toLowerCase() === 'true')`) for boolean env vars. We hit this with `PDS_INVITE_REQUIRED`.

- The Phase 2 PDS admin password is per-user, generated by fuzex-api at signup, encrypted with AES-256-GCM using a key derived from `PDS_PASSWORD_ENCRYPTION_KEY` (via scrypt with a fixed domain-separator salt), and stored in `users.pds_password_encrypted`. Phase 3 will move these to a Secret Manager. See [ADR 0006](docs/decisions/0006-encrypted-pds-passwords-in-postgres.md).

## Coverage tracker

Current state at end of Phase 1:

Re-included over the course of Phase 1:
- `src/app.ts`                  ✅ (Prompt 4)
- `src/shared/middleware/**`    ✅ (Prompt 4)
- `src/shared/errors/**`        ✅ (Prompt 5)

Permanent exclusions (intentional, will not change):
- `src/index.ts`                — bootstrap, hard to unit-test meaningfully
- `src/shared/config/**`        — env validation; tested implicitly by app harness
- `src/shared/logger/**`        — logger config, side-effect heavy
- `src/shared/db/index.ts`      — singleton wiring
- `src/shared/db/migrationRunner.ts` — re-include if it gains pure logic
- `src/shared/testing/**`       — test helpers
- `src/**/index.ts`             — barrel files
- `src/shared/db/migrate.ts`    — CLI entry, smoke-tested by deploy.sh
- `src/shared/db/migrations/**` — generated SQL
- `src/shared/middleware/errorHandler.ts` — exercised at runtime; re-include when a second error-throwing path exists alongside HandleResolutionError

Phase 1 final coverage: 90.37% statements / 77.33% branches / 89.79% functions / 90.27% lines.

Threshold remains 70% on all metrics.

## Build / Deployment

- TypeScript's `@/` path alias is NOT rewritten by `tsc` in compiled output. The build script must run `tsc-alias -p tsconfig.build.json` after `tsc -p tsconfig.build.json` so that compiled `dist/*.js` files have their `@/...` imports replaced with proper relative paths. tsx (dev) and Jest (tests) handle this differently — they rewrite at runtime.

## Caddy + Bluesky PDS TLS interactions

- PDS `/tls-check` only approves cert issuance for hostnames that match a registered handle on the PDS. Hostnames outside the configured `PDS_SERVICE_HANDLE_DOMAINS` get `InvalidRequest: handles are not provided on this domain`. Bare hostnames (the PDS's own service hostname) are NOT specially approved by `/tls-check` — Caddy must obtain that cert via the normal HTTP-01 challenge at startup, not via on-demand.

- Caddy's TLS policy matching uses the policies array in order. When an explicit hostname (e.g. `api.dev.fuzex.app`) ALSO falls under a wildcard (e.g. `*.dev.fuzex.app`) and the wildcard's policy comes first with `on_demand: true`, the wildcard wins — Caddy never tries the more-specific policy. Reordering Caddyfile site blocks does NOT change this because the Caddyfile-to-JSON adapter groups all on-demand subjects into a single policy regardless of declaration order.

- The fix: put the API on a hostname that is NOT lexically under the wildcard. Sibling subdomains (`dev-api.fuzex.app` instead of `api.dev.fuzex.app`) avoid the collision entirely.

## fuzex-api architecture

- The `users` table maps `firebase_uid` ↔ atproto identity (`did`, `handle`) ↔ wallet address. Firebase Auth holds the user identity; the embedded wallet system holds private keys in Secret Manager; fuzex-api Postgres holds only the public mappings. Wallet addresses are never private; private keys NEVER touch the VPS.

- Firestore is the source of truth for user-input profile data (displayName, dateOfBirth, gender, walletAddress). fuzex-api reads it from Firestore at signup time and copies relevant fields into Postgres for atproto-related queries. There's intentional duplication between Firestore and Postgres because they serve different access patterns (Firestore = real-time mobile reads, Postgres = atproto handle resolution from Caddy/Bluesky).

- For phone-only signups (no email in Firebase token), fuzex-api synthesizes a placeholder email of the form `phone-{e164-digits-only}@email.fuzex.app` to satisfy PDS's `createAccount` email requirement. The user never sees this email; PDS uses our auto-generated password (not user-facing) for any internal needs.

## Known Limitations

- **lint-staged scope**: The pre-commit hook runs `cd api && npx lint-staged`, which scopes file matching to the api/ package. Root-level files (CHANGELOG.md, README.md, root configs) are not formatted by lint-staged on commit. Source code in api/ is fully linted as expected. Tracked for future resolution — likely requires either a root package.json with workspaces or duplicating lint-staged config at the root.
