# Database layer

## Stack

- PostgreSQL 16
- Drizzle ORM
- pg (node-postgres)

## Local setup

The dev DB runs in Docker on host port **5433** (not 5432, to avoid conflicts):

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

When initialised this way, `fuzex_api_dev` is the bootstrap superuser of the
container and already has the `CREATEDB` privilege — required so the test
setup can auto-create the test DB. If you ever recreate the DB user with
fewer privileges, grant it explicitly:

```bash
docker exec -it fuzex-postgres-dev \
  psql -U fuzex_api_dev -d postgres \
  -c "ALTER USER fuzex_api_dev CREATEDB;"
```

## Schema

Three tables — see [schema.ts](./schema.ts):

- `users` — Firebase UID ↔ atproto identity ↔ wallet mapping
- `audit_logs` — append-only log of social-layer actions
- `invite_codes` — closed-registration invite codes (used in Phase 2)

## Migrations

Migrations are SQL files in `migrations/`, applied by Drizzle's migrator.
The `meta/_journal.json` file tracks which have been applied.

We hand-write migrations for explicit control over indexes, constraints, and
ordering — we do NOT use `drizzle-kit generate`.

### Apply migrations

```bash
npm run db:migrate
```

### Reset the dev DB (destructive)

```bash
docker exec -it fuzex-postgres-dev psql -U fuzex_api_dev -d fuzex_social_dev \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:migrate
```

## Repository pattern

Repositories receive a `Database` via constructor — they MUST NOT import the
singleton DB. This makes them testable.

```ts
import { UsersRepository } from '@/shared/db/repositories/index.js';
import { getDb } from '@/shared/db/index.js';

const usersRepo = new UsersRepository(getDb());
```

In tests, pass a test DB instead:

```ts
const handle = createTestDb();
const repo = new UsersRepository(handle.db);
```
