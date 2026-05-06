# fuzex-social

The social/atproto layer for **FuzeX** — decentralized social media + activity booking + crypto wallet platform.

This monorepo contains the Hono backend, Postgres schema, infrastructure configs, and deployment scripts that connect FuzeX to the atproto network (Bluesky federation).

## Architecture (high level)

```
┌─────────────────────────────────────────────────────────────────┐
│  Hetzner VPS (Nuremberg)                                         │
│                                                                   │
│  Caddy ─┬─→ Bluesky PDS (port 3000) ─── PDS SQLite              │
│         └─→ fuzex-api (port 3001) ─→ Postgres (port 5432)       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

External (cloud):
- Firestore     — existing FuzeX product data (untouched)
- Firebase Auth — user authentication
- Secret Manager — wallet private keys
- Resend        — SMTP for PDS
```

## Repository Structure

| Path | Purpose |
|---|---|
| `api/` | Hono backend (TypeScript) |
| `infrastructure/` | Caddy configs, Postgres init scripts |
| `scripts/` | VPS setup + deployment scripts |
| `docs/` | Architecture, deployment, operations, ADRs |

## Quick Start

```bash
# Install Node 20
nvm use

# Install API deps
cd api
cp .env.dev.example .env
npm install

# Start local Postgres (Docker, port 5433)
docker run -d --name fuzex-postgres-dev \
  -e POSTGRES_DB=fuzex_social_dev \
  -e POSTGRES_USER=fuzex_api_dev \
  -e POSTGRES_PASSWORD=devpassword \
  -p 5433:5432 \
  --restart unless-stopped \
  postgres:16

# Dev server
npm run dev
```

## Documentation

- [`docs/architecture.md`](./docs/architecture.md) — system design
- [`docs/deployment.md`](./docs/deployment.md) — deploy guide
- [`docs/operations.md`](./docs/operations.md) — day-2 ops
- [`docs/api-reference.md`](./docs/api-reference.md) — endpoint reference

## License

UNLICENSED — Proprietary. See [LICENSE](./LICENSE).
