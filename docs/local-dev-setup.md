# Local Development Setup

This guide gets you from a fresh clone to a running dev server with all tests
passing. Estimated time: 10 minutes if you have Node and Docker already.

## Prerequisites

- **Node.js 20 LTS** (via [nvm](https://github.com/nvm-sh/nvm) recommended)
- **Docker** (for local Postgres)
- **Git**
- A terminal with reasonable defaults (any modern shell works)

If you already have a different Node version installed, that's fine — `nvm`
handles version switching per-project.

## Step 1 — Clone the repo

```bash
git clone git@github.com:Akramovic1/fuzex-social.git
cd fuzex-social
```

## Step 2 — Install Node 20

If you don't have nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc   # or ~/.zshrc
```

Then:

```bash
nvm install 20
nvm use            # picks up .nvmrc in the repo (which says "20")
node --version     # should print v20.x.x
```

## Step 3 — Start local Postgres in Docker

We use port **5433** on the host (not the default 5432) to avoid conflicts
with any other Postgres instance you might have running.

```bash
docker run -d \
  --name fuzex-postgres-dev \
  -e POSTGRES_DB=fuzex_social_dev \
  -e POSTGRES_USER=fuzex_api_dev \
  -e POSTGRES_PASSWORD=devpassword \
  -p 5433:5432 \
  --restart unless-stopped \
  postgres:16
```

Verify it's running:

```bash
docker ps | grep fuzex-postgres-dev   # should show "Up X seconds"
```

Test the connection:

```bash
PGPASSWORD=devpassword psql -h localhost -p 5433 -U fuzex_api_dev -d fuzex_social_dev -c "SELECT version();"
```

If that errors with "port is already allocated", another container is using 5432
or 5433. Either stop that container or change the port mapping (`-p NEW_PORT:5432`)
and update `DATABASE_URL` to match.

The container has the `fuzex_api_dev` user as the bootstrap superuser, so it
already has the `CREATEDB` privilege needed for the test DB. No further grants
needed.

## Step 4 — Install dependencies

```bash
cd api
npm install
```

This downloads ~250MB of `node_modules`. Takes 30-60s.

## Step 5 — Configure your `.env`

```bash
cp .env.dev.example .env
```

The defaults match the Postgres container above. No edits needed unless you
changed the Docker port.

## Step 6 — Run database migrations

```bash
npm run db:migrate
```

This creates the `users`, `audit_logs`, and `invite_codes` tables in
`fuzex_social_dev`.

Verify:

```bash
docker exec fuzex-postgres-dev psql -U fuzex_api_dev -d fuzex_social_dev -c "\dt"
# Should list: users, audit_logs, invite_codes, __drizzle_migrations
```

## Step 7 — Run the tests

```bash
npm test
```

First run auto-creates the `fuzex_social_test` database and runs migrations
against it. Subsequent runs reuse it.

Expected: 90 tests pass in ~2 seconds.

## Step 8 — Start the dev server

```bash
npm run dev
```

The server listens on the `PORT` from your `.env` (default 3001).

In another terminal:

```bash
curl http://localhost:3001/health
```

Expected:

```json
{
  "status": "ok",
  "uptime": 3,
  "version": "0.1.0",
  "timestamp": "2026-...",
  "db": "ok"
}
```

For the well-known and resolve endpoints to return data, seed the test account:

```bash
docker exec -i fuzex-postgres-dev psql -U fuzex_api_dev -d fuzex_social_dev \
  < ../scripts/seed-akram.sql
```

Then:

```bash
curl -H "Host: akram.dev.fuzex.app" http://localhost:3001/.well-known/atproto-did
# did:plc:cwbqnunxsu7isx4vv4zul4un

curl http://localhost:3001/v1/resolve/akram.dev.fuzex.app | jq .
# Full JSON summary
```

## npm scripts cheat sheet

All run from `api/`:

| Script | Purpose |
|---|---|
| `npm run dev` | Watch-mode dev server (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | Type check without emit |
| `npm run lint` | Lint TypeScript files |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Run Prettier write |
| `npm run format:check` | Run Prettier check |
| `npm test` | Run Jest |
| `npm run test:watch` | Jest watch mode |
| `npm run test:coverage` | Tests with coverage report |
| `npm run db:generate` | Generate a Drizzle migration from schema (we hand-write — only use for inspiration) |
| `npm run db:migrate` | Apply migrations to dev DB |
| `npm run db:migrate:test` | Apply migrations to test DB |
| `npm run db:reset:test` | Drop + recreate test DB schema |
| `npm run db:studio` | Drizzle Studio (browser DB explorer) |

## Common issues

### `npm install` fails with "engine" warnings

Your Node version is too old. Run `nvm use` from the repo root.

### Tests fail with "permission denied to create database"

The Postgres container's bootstrap user usually has `CREATEDB`. If you used a
different setup:

```bash
docker exec fuzex-postgres-dev \
  psql -U postgres -c "ALTER USER fuzex_api_dev CREATEDB;"
```

### Husky hooks aren't firing on commit

```bash
cd api
npm run prepare
```

This re-installs husky's git hooks.

### Port 5432 is already in use

Another Postgres is already running. Either stop it, or change the Docker
port mapping (e.g., `-p 5434:5432`) and update `DATABASE_URL` in `.env` to
match.

### `npm run dev` says "EADDRINUSE: 3001"

Another process is on 3001. Find and kill it, or change `PORT` in `.env`.

```bash
lsof -i :3001
kill <pid>
```

### "Cannot find module '@/...'" in tests

The Jest module mapper handles this. If you hit this:
1. Make sure the import has the `.js` extension in the specifier (yes, even
   for `.ts` source files — Node ESM rule)
2. Run `npm test` from the `api/` directory, not from repo root

## What to read next

- [`README.md`](../README.md) — high-level overview
- [`docs/architecture.md`](./architecture.md) — system design
- [`docs/api-reference.md`](./api-reference.md) — endpoint reference
- [`docs/operations.md`](./operations.md) — when something breaks

If you'll be deploying:
- [`docs/deployment.md`](./deployment.md) — deploying to the dev VPS
- [`docs/production-vps-setup.md`](./production-vps-setup.md) — production playbook
- [`docs/vps-dev-setup-history.md`](./vps-dev-setup-history.md) — how the dev VPS got set up (with dead ends)

## Code structure orientation

```
api/src/
├── index.ts                          # Server bootstrap
├── app.ts                            # Hono app factory (middleware + module routes)
├── modules/
│   └── api-social/                   # The social/atproto-facing module
│       ├── routes/                   # HTTP layer (thin handlers)
│       ├── services/                 # Domain logic
│       ├── lib/                      # Pure helpers
│       └── schemas/                  # zod response shapes
└── shared/
    ├── config/                       # Env validation
    ├── db/                           # Drizzle schema, repositories, migrations
    ├── errors/                       # AppError hierarchy
    ├── logger/                       # Pino logger
    ├── middleware/                   # Hono middleware (correlation ID, rate limit, etc.)
    ├── testing/                      # Test helpers (test DB, app harness)
    └── utils/                        # Generic helpers
```

Conventions:
- Routes throw `AppError` subclasses — never raw errors
- Services receive their dependencies via constructor (no singleton imports)
- ESM imports use `.js` extension even for TypeScript source files
- `@/` path alias resolves to `api/src/`

For the full conventions list, see [`NewKnowledgeBase.md`](../NewKnowledgeBase.md)
at the repo root.
