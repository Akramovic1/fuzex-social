# Testing helpers

## Test database

Tests use a separate Postgres database `fuzex_social_test` on the same instance
as dev (`localhost:5433`).

The test setup script ([jestSetup.ts](./jestSetup.ts)):
1. Connects to the `postgres` system DB
2. Creates `fuzex_social_test` if it doesn't exist
3. Runs all migrations against it

The test DB is preserved between runs (we truncate per-suite, not drop the DB)
for fast iteration.

## Prerequisite: CREATEDB privilege

The dev DB user (`fuzex_api_dev`) needs the `CREATEDB` privilege so the test
setup can auto-create the test DB. When the container is bootstrapped with
`POSTGRES_USER=fuzex_api_dev`, that user is already a superuser and has this
privilege by default. If you ever recreate the user with fewer privileges,
grant it once:

```bash
docker exec -it fuzex-postgres-dev \
  psql -U fuzex_api_dev -d postgres \
  -c "ALTER USER fuzex_api_dev CREATEDB;"
```

If you skip this and the test DB doesn't exist yet, you'll see:

```
permission denied to create database
```

Just grant the privilege and re-run the tests.

## Per-suite usage

```ts
import { afterAll, beforeEach, describe } from '@jest/globals';
import { createTestDb, truncateAll } from '@/shared/testing/testDb.js';

describe('MyRepository', () => {
  const handle = createTestDb();

  beforeEach(async () => {
    await truncateAll(handle.db);
  });

  afterAll(async () => {
    await handle.close();
  });

  // tests...
});
```
