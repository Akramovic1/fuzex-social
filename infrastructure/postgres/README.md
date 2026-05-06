# PostgreSQL setup

This directory holds the one-time SQL needed to provision the fuzex-api
database on a fresh VPS.

## Files

| File | Purpose |
|---|---|
| `init.sql` | Creates the `fuzex_api` user and `fuzex_social` database |

## When to run

Run ONCE per VPS, immediately after PostgreSQL is installed and before the
first deployment.

## How to run

```bash
# As root on the VPS:
nano /opt/fuzex-social/infrastructure/postgres/init.sql
# Replace CHANGE_ME_STRONG_PASSWORD with a real password (save in password manager)

sudo -u postgres psql -f /opt/fuzex-social/infrastructure/postgres/init.sql
```

After running, the VPS has:
- A `fuzex_api` user with login privileges
- A `fuzex_social` database owned by `fuzex_api`
- The `pgcrypto` extension enabled for UUID generation

The application then connects via:

```
DATABASE_URL=postgresql://fuzex_api:THE_PASSWORD@localhost:5432/fuzex_social
```

## Migrations

This file does NOT create tables. The application's Drizzle migrations
(`api/src/shared/db/migrations/`) handle schema. Run them after init:

```bash
cd /opt/fuzex-social/api
npm run db:migrate
```

## Backups

Phase 1 has no automated backup. Manual snapshot:

```bash
sudo -u postgres pg_dump fuzex_social > /tmp/fuzex_social-$(date +%Y%m%d).sql
```

Move to off-server storage. Full backup automation comes in Phase 2.
