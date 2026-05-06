# Architecture

## Overview

`fuzex-social` is the social/atproto layer of FuzeX. It runs alongside a
Bluesky PDS on a single Hetzner VPS and exposes endpoints used by:

- The Bluesky atproto network (handle resolution via `/.well-known/atproto-did`)
- The FuzeX mobile app (tipping resolver via `/v1/resolve/:handle`)
- Future authenticated flows (account creation, session minting — Phase 2)

## System diagram

```
                        ┌─────────────────────────────────────────────────┐
                        │  Hetzner CX23 VPS (Nuremberg)                   │
                        │                                                  │
       Bluesky AppView  │   ┌──────────┐                                  │
       calls handle.../─┼──→│  Caddy   │ ─→ port 3000 ─→  Bluesky PDS    │
       .well-known/...  │   │   :443   │                       │          │
                        │   │          │                       ↓          │
       FuzeX mobile     │   │          │ ─→ port 3001 ─→  fuzex-api      │
       calls /v1/...    │   │          │                       │          │
                        │   └──────────┘                       ↓          │
                        │                                Postgres (5432)  │
                        │                                                  │
                        └──────────────────────────────────────────────────┘
                                              │
                                              ↓
                            External services (cloud, untouched):
                            - Firestore     (existing FuzeX product data)
                            - Firebase Auth (user authentication)
                            - Secret Manager (wallet private keys)
                            - Resend         (SMTP for PDS)
```

## Data ownership

| Data | Where | Why |
|---|---|---|
| Existing FuzeX product data (profiles, bookings, events, wallet metadata) | Firestore | Already there, real-time sync, mobile offline-first, no migration risk |
| Atproto records (posts, likes, follows, repos) | PDS internal SQLite | That's what PDS is for |
| Wallet private keys | Secret Manager | Encrypted, audited, never on application server |
| `did ↔ handle ↔ wallet_address` mapping | Postgres on VPS (NEW) | Localhost queries, social-layer-specific, low risk if lost (rebuildable) |
| Audit logs of social-layer actions | Postgres on VPS | Queryable, cheap, doesn't bloat Firestore |
| Authentication | Firebase Auth | Already there |

This is a deliberate **hybrid**: existing data stays put; only NEW
social-layer data lives in the VPS Postgres.

## Components

### Caddy (reverse proxy)

- Auto-issues SSL via Let's Encrypt with on-demand TLS
- Routes by hostname:
  - `pds.dev.fuzex.app`, `*.pds.dev.fuzex.app` → PDS (port 3000)
  - `api.dev.fuzex.app` → fuzex-api (port 3001)
  - `*.dev.fuzex.app/.well-known/atproto-did` → fuzex-api
  - everything else under `*.dev.fuzex.app` → 404

### Bluesky PDS

- Stock Bluesky PDS install (Docker)
- Handles atproto records, federation with the relay, posting
- Uses Resend for SMTP

### fuzex-api (this repo)

- Node.js 20 + Hono + Drizzle ORM
- Runs under pm2
- Stack: TypeScript strict, ESM, Pino logging, zod validation, Jest tests
- Endpoints (Phase 1):
  - `GET /health` — liveness + DB ping
  - `GET /.well-known/atproto-did` — handle resolution from Postgres
  - `GET /v1/resolve/:handle` — public tipping resolver

### PostgreSQL

- Postgres 16 on the VPS
- Listens on localhost only (firewalled from public internet)
- Database `fuzex_social`, user `fuzex_api`
- 3 tables: `users`, `audit_logs`, `invite_codes`

## Request flows

### Atproto handle verification

```
Bluesky AppView wants to verify "akram.dev.fuzex.app"
  ↓
Bluesky calls https://akram.dev.fuzex.app/.well-known/atproto-did
  ↓
Cloudflare DNS returns VPS IP
  ↓
Caddy receives request
  - matches *.dev.fuzex.app block
  - matches /.well-known/atproto-did
  - reverse-proxies to localhost:3001 with original Host header
  ↓
fuzex-api wellKnownAtprotoDid route
  - reads Host header: "akram.dev.fuzex.app"
  - parseHandle() → username "akram"
  - validates format + checks reserved list
  - UsersRepository.findByUsername("akram")
  - returns DID as text/plain (no trailing newline)
  ↓
Bluesky verifies handle matches PLC document
  ↓
Handle valid ✅
```

### Tipping flow (future use, endpoint exists today)

```
FuzeX mobile app: user taps "Tip @sara.fuzex.app"
  ↓
App calls https://api.dev.fuzex.app/v1/resolve/sara.fuzex.app
  ↓
fuzex-api resolveHandle route
  - parses handle, validates, checks reserved
  - findByUsername → user record
  - returns { did, walletAddress, chain, tippingEnabled }
  ↓
App reads walletAddress, executes wallet transfer directly
  (FuzeX backend is NOT in the funds path — it's a name resolver only)
```

## Why these choices

See ADRs in `docs/decisions/` for the reasoning behind:
- Postgres on the VPS (not Firestore for this layer)
- No Redis cache in Phase 1
- Existing Firestore data stays in Firestore

## Security

- Postgres binds to localhost only
- Caddy auto-renews SSL; on-demand TLS is gated by the PDS's `/tls-check`
  ask hook so we don't issue certs for arbitrary hostnames
- fuzex-api validates and lowercases all handle input before any DB query
- Reserved usernames are checked BEFORE the DB query (defense in depth)
- All errors are routed through one handler; raw stack traces never leak
  to clients
- `pino` redacts auth/cookie/password/token/secret paths from logs
- Database password and other secrets live ONLY in `/opt/fuzex-social/api/.env`
  (chmod 600), never committed
- pm2 runs as root on the dev VPS; production should run as a dedicated
  unprivileged user (Phase 2 hardening)
