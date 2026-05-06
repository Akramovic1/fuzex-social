# fuzex-social

The social/atproto layer for **FuzeX** — decentralized social media + activity
booking + crypto wallet platform.

This monorepo contains the Hono backend (`api/`), Postgres schema, infrastructure
configs, and deployment scripts that connect FuzeX to the atproto network.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Hetzner VPS (Nuremberg)                                          │
│                                                                    │
│  Caddy ─┬─→ Bluesky PDS (port 3000) ─── PDS SQLite               │
│         └─→ fuzex-api (port 3001) ─→ Postgres (port 5432)        │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘

External (cloud):
- Firestore     — existing FuzeX product data (untouched)
- Firebase Auth — user authentication
- Secret Manager — wallet private keys
- Resend        — SMTP for PDS
```

For the full design, see [`docs/architecture.md`](./docs/architecture.md).

## Getting started

| Audience | Start here |
|---|---|
| New developer setting up locally | [`docs/local-dev-setup.md`](./docs/local-dev-setup.md) |
| Deploying to the dev VPS | [`docs/deployment.md`](./docs/deployment.md) |
| Provisioning a fresh production VPS | [`docs/production-vps-setup.md`](./docs/production-vps-setup.md) |
| Day-2 operations | [`docs/operations.md`](./docs/operations.md) |
| API endpoint reference | [`docs/api-reference.md`](./docs/api-reference.md) |
| How the dev VPS was originally provisioned | [`docs/vps-dev-setup-history.md`](./docs/vps-dev-setup-history.md) |

## Repository structure

| Path | Purpose |
|---|---|
| `api/` | Hono backend (TypeScript) |
| `infrastructure/` | Caddy configs, Postgres init scripts |
| `scripts/` | VPS setup + deployment + seeds |
| `docs/` | Architecture, deployment, operations, ADRs, prompts |

## License

UNLICENSED — Proprietary. See [LICENSE](./LICENSE).
