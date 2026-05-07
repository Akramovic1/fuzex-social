# E2E test suite

End-to-end tests for fuzex-api hitting the **live dev backend** at
`https://dev-api.fuzex.social`. These tests catch regressions that unit tests
miss — Caddy config, env-file drift, real PDS state, real Firestore reads,
real TLS handshakes.

## Layers

| Layer | What it tests | Mutates state | Time |
|---|---|---|---|
| **01-smoke** | Public endpoints — `/health`, `/v1/username/check`, `/v1/resolve`, `/.well-known/atproto-did`, PDS health | No | ~5s |
| **02-authenticated** | `getSession`, JWT shape & claims, 401 paths, idempotent `createAccount` for an existing user | No | ~10s |
| **03-lifecycle** | Full createAccount flow — fresh user → resolve → well-known → getSession → idempotency | **Yes** (creates a real PDS account on the dev VPS) | ~30s |

## Quick start

```bash
cd tests/e2e
npm install
cp .env.example .env

# Place the firebase service account JSON
cp ~/Downloads/fuzex-dev-service-account.json firebase-service-account.json
chmod 600 firebase-service-account.json

# Run the full suite (~45s; creates one Layer 3 user that auto-cleans Firebase
# but leaves Postgres + PDS sqlite rows on the VPS — see "Cleanup" below).
npm test
```

Per-layer:

```bash
npm run test:smoke       # Layer 1 only
npm run test:auth        # Layer 2 only
npm run test:lifecycle   # Layer 3 only
```

## Configuration

| Var | Required | Default | Purpose |
|---|---|---|---|
| `E2E_API_BASE` | No | `https://dev-api.fuzex.social` | API base URL |
| `E2E_PDS_BASE` | No | `https://pds.dev.fuzex.social` | PDS base URL |
| `FIREBASE_WEB_API_KEY` | **Yes** | — | Public Firebase web API key (also embedded in mobile apps) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | No | `./firebase-service-account.json` | Path to Firebase admin service account JSON |
| `E2E_TEST_USER_UID` | **Yes** | — | UID of the existing dev test user (Layer 1 + 2) |
| `E2E_TEST_USER_HANDLE` | **Yes** | — | Existing handle (e.g. `t100.dev.fuzex.social`) |
| `E2E_TEST_USER_DID` | **Yes** | — | Existing DID (`did:plc:...`) |
| `E2E_TEST_USER_WALLET` | **Yes** | — | Existing wallet address |
| `PDS_ADMIN_PASSWORD` | No | unset | If set, Layer 3 step 6 verifies the new account via PDS admin API |
| `E2E_USER_PREFIX` | No | `e2e` | Prefix for dynamically-generated Layer 3 test users |

## Cleanup

### Auto-cleaned after each Layer 3 run

- Firebase Auth user (`uid` starts with `e2e-`)
- Firestore `Users/{uid}` document

### Manual cleanup (left on the VPS)

When Layer 3 creates a real PDS account, two pieces of state outlive the test:

1. The Postgres `users` row in `fuzex_social`
2. The PDS sqlite `account` and `actor` rows in `/pds/account.sqlite`

The afterAll hook prints the exact commands to run for the most recent test
user. To clean up **all** leftover e2e users at once:

```bash
ssh fuzex-pds-dev

# 1. Postgres rows
sudo -u postgres psql -d fuzex_social \
  -c "DELETE FROM users WHERE firebase_uid LIKE 'e2e-%';"

# 2. List leftover PDS rows for these users (you'll need the DIDs)
sqlite3 /pds/account.sqlite \
  "SELECT did, email FROM account WHERE email LIKE 'e2e-%@fuzex.io';"

# 3. For each DID returned above, delete from PDS sqlite
sqlite3 /pds/account.sqlite \
  "DELETE FROM account WHERE email LIKE 'e2e-%@fuzex.io';"
sqlite3 /pds/account.sqlite \
  "DELETE FROM actor WHERE did IN (SELECT did FROM account WHERE email LIKE 'e2e-%@fuzex.io');"
```

Why the asymmetry? Firebase has a clean admin SDK delete; the VPS state is
behind SSH and Docker. We don't bake VPS-side cleanup into the test runner
to keep the suite stack-light and runnable from any machine.

## Running against production

⚠️ **Do not run Layer 3 against production.** It creates a real account and
the cleanup commands above target dev hostnames. Only run Layers 1 and 2:

```bash
E2E_API_BASE=https://api.fuzex.social \
E2E_PDS_BASE=https://pds.fuzex.social \
E2E_TEST_USER_HANDLE=<a-real-prod-handle> \
E2E_TEST_USER_DID=<their-real-DID> \
E2E_TEST_USER_WALLET=<their-real-wallet> \
E2E_TEST_USER_UID=<their-firebase-uid> \
npm run test:smoke
npm run test:auth
```

## Architecture

- **Stack:** vitest 2.x, firebase-admin 12.x, plain `fetch` (Node 20+ native).
- **No mocking.** Tests hit the live backend by design.
- **Sequential execution:** `vitest.config.ts` sets `fileParallelism: false` and
  `singleFork: true` so the three layers run one at a time. Layer 3 has
  cross-step shared state (the created DID is captured in step 2 and used
  through step 8).
- **JWT decoding without verification.** `helpers/jwt-decoder.ts` only parses
  the base64url segments — signature verification is the PDS's job. We use it
  only to inspect claims for assertions.
- **Custom-token-then-exchange dance:** Firebase ID tokens for arbitrary UIDs
  are minted via `firebase-admin createCustomToken(uid)` followed by a POST
  to the Identity Toolkit REST API with the public web API key. This lets
  us authenticate as any user without booting the mobile app.
- **Cleanup is best-effort:** the `afterAll` hook logs warnings if Firebase
  delete fails but never throws. The suite always finishes cleanly.

## Troubleshooting

### `Missing required env var: FIREBASE_WEB_API_KEY`

Copy `.env.example` to `.env` and fill in the values. All required vars
are listed in the configuration table above.

### `Firebase service account JSON not found at /path/to/...`

Either set `FIREBASE_SERVICE_ACCOUNT_PATH` to the right location, or copy
the JSON to `tests/e2e/firebase-service-account.json` (the default).

### Layer 3 step 5 fails with TLS handshake error

When a brand-new handle subdomain (like `e2e-y3in-aba89271.dev.fuzex.social`)
is requested for the first time, Caddy obtains a cert via on-demand TLS,
gated by PDS `/tls-check`. The first 1-2 requests can fail with a TLS error
while the cert is being minted.

The test retries up to 5 times with 3-second delays. If it still fails after
that, check:

- Is the PDS responding on `/tls-check`? `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`
- Is the new handle registered with PDS? `sqlite3 /pds/account.sqlite "SELECT handle FROM account WHERE handle = '<your-handle>';"`
- Are the Caddy logs showing cert acquisition? `docker logs caddy --tail 50`

### Layer 3 step 6 returns 401 (PDS admin)

The dev VPS's `/opt/fuzex-social/api/.env` and `/pds/pds.env` must have the
**same** `PDS_ADMIN_PASSWORD`. The original migration left a placeholder
string (`PASTE_FROM_PDS_ADMIN_PWD_VARIABLE_HERE`) in the api `.env`; if the
test sees 401 from the admin endpoint, that placeholder is back. Sync from
`/pds/pds.env`:

```bash
ssh fuzex-pds-dev
grep ^PDS_ADMIN_PASSWORD /pds/pds.env  # actual value
grep ^PDS_ADMIN_PASSWORD /opt/fuzex-social/api/.env  # should match
```

### Orphan PDS sqlite rows blocking signups with the same email

If `createAccount` succeeds at the PDS step but fails downstream (e.g., the
fuzex-api process crashes before inserting into Postgres), the PDS sqlite
row is left behind. Future signups using the same email get rejected by the
UNIQUE constraint on `account_email_lower_idx`. See the cleanup commands
above; this is the most common cause of mysterious createAccount failures
during E2E development.

## Future work

- **CI integration:** wire `npm run test:smoke` and `npm run test:auth` into
  GitHub Actions on every push. Layer 3 should run on a separate cadence
  (nightly cron or pre-deploy gate).
- **Schema-level assertions:** add zod parsing of every response body, not
  just structural matches. Catches drift between docs and reality.
- **Federation verification:** add a Layer 4 that polls Bluesky's relay
  (`public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle`) until the
  new handle is discoverable end-to-end.
