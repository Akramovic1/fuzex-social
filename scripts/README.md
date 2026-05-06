# Scripts

Operational scripts for FuzeX social VPS provisioning, deployment, and
one-off utilities.

| File | Purpose |
|---|---|
| `seed-akram.sql` | Inserts the test account `akram` (idempotent) |

## Coming in Prompt 6

| File | Purpose |
|---|---|
| `setup-vps.sh` | Idempotent VPS setup (Node, pm2, Postgres) |
| `deploy.sh` | git pull, build, migrate, pm2 reload |

## Usage

### seed-akram.sql

Run from the repo root:

```bash
docker exec -i fuzex-postgres-dev psql -U fuzex_api_dev -d fuzex_social_dev \
  < scripts/seed-akram.sql
```

For the test DB (used by Jest), the seed is NOT applied — tests insert their
own fixtures. Use this seed only for end-to-end manual verification.
