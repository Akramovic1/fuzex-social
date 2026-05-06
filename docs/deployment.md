# Deployment

How to deploy fuzex-api to the dev VPS.

## Prerequisites

- A Hetzner VPS running Ubuntu 24.04 (or any Debian-based distro)
- Bluesky PDS already installed and running (Caddy on ports 80/443, PDS on 3000)
- DNS configured at Cloudflare:
  - `pds.dev.fuzex.app` → VPS IP (DNS-only, gray cloud)
  - `dev-api.fuzex.app` → VPS IP (DNS-only, gray cloud)
  - `*.dev.fuzex.app` → VPS IP (DNS-only, gray cloud)

## First-time setup (one-time per VPS)

### 1. SSH to the VPS as root

```bash
ssh root@<vps-ip>
```

### 2. Clone and run setup-vps.sh

```bash
git clone https://github.com/Akramovic1/fuzex-social.git /opt/fuzex-social
bash /opt/fuzex-social/scripts/setup-vps.sh
```

This installs Node 20, pm2, PostgreSQL 16 (if not present), creates
`/opt/fuzex-social`, and generates an SSH deploy key. The script prints the
public key at the end.

### 3. Add the deploy key to GitHub

Paste the printed public key into GitHub:

```
Repo settings → Deploy keys → Add deploy key
- Title: vps-dev-deploy
- Key: (paste)
- Allow write access: NO
```

### 4. Re-clone via SSH

The first clone used HTTPS (read-only is fine). Switch to SSH so future pulls use the deploy key:

```bash
cd /opt/fuzex-social
git remote set-url origin git@github.com:Akramovic1/fuzex-social.git
ssh -T git@github.com    # should say "Hi Akramovic1/fuzex-social!"
```

### 5. Initialize Postgres

```bash
nano /opt/fuzex-social/infrastructure/postgres/init.sql
# Replace CHANGE_ME_STRONG_PASSWORD with a real strong password
# (save it in password manager — you'll need it in the next step)

sudo -u postgres psql -f /opt/fuzex-social/infrastructure/postgres/init.sql
```

### 6. Configure the API .env

```bash
cd /opt/fuzex-social/api
cp .env.example .env
nano .env
```

Set:

```
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
DATABASE_URL=postgresql://fuzex_api:THE_PASSWORD@localhost:5432/fuzex_social
HANDLE_DOMAIN=.dev.fuzex.app
PDS_URL=https://pds.dev.fuzex.app
CORS_ALLOWED_ORIGINS=https://app.fuzex.app
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

```bash
chmod 600 .env
```

### 7. First deploy

```bash
bash /opt/fuzex-social/scripts/deploy.sh
```

This runs `npm ci`, builds, migrates, starts under pm2, and smoke-tests
`/health`. Successful output ends with `[ok] deploy complete`.

### 8. Update Caddy

The current Caddyfile has a temporary hardcoded block for `akram.dev.fuzex.app`
that we now replace with proper routing.

```bash
# Backup current config
cp /pds/caddy/etc/caddy/Caddyfile /pds/caddy/etc/caddy/Caddyfile.before-fuzex-api

# Install new config
cp /opt/fuzex-social/infrastructure/caddy/Caddyfile.dev /pds/caddy/etc/caddy/Caddyfile

# Validate
docker exec caddy caddy validate --config /etc/caddy/Caddyfile

# Reload (zero-downtime)
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

If validation fails, restore the backup and fix the config before reloading.

### 9. Seed akram (for migration verification)

The new well-known endpoint reads from Postgres. To match the existing
PDS state, seed the akram record:

```bash
nano /opt/fuzex-social/scripts/seed-akram.sql
# Replace the placeholder wallet_address with akram's real wallet if available

sudo -u postgres psql -d fuzex_social -f /opt/fuzex-social/scripts/seed-akram.sql
```

### 10. Verify end-to-end

```bash
# From your local machine:

# Health
curl https://dev-api.fuzex.app/health

# Resolve
curl https://dev-api.fuzex.app/v1/resolve/akram.dev.fuzex.app

# Well-known (should return DID with no trailing newline)
curl -i https://akram.dev.fuzex.app/.well-known/atproto-did

# Bluesky AppView (cached — may take time)
curl "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=akram.dev.fuzex.app"
```

If all four return expected results, deployment is successful.

## Subsequent deploys

```bash
ssh root@<vps-ip>
bash /opt/fuzex-social/scripts/deploy.sh
```

The script is idempotent and uses zero-downtime pm2 reload.

## Rolling back

The deploy script does a hard reset to the deployed branch. To roll back:

```bash
cd /opt/fuzex-social
git log --oneline -10                        # find the previous good commit
git reset --hard <previous-good-sha>
cd api
npm ci --omit=optional
npm run build
pm2 reload fuzex-api --update-env
```

If a recent migration broke things, you'll also need to manually revert the
DB. Phase 1 has no automated migration rollback; document the recovery in
the operations runbook.

## Branches

By default, `deploy.sh` deploys `main`. To deploy another branch:

```bash
DEPLOY_BRANCH=feature/my-branch bash /opt/fuzex-social/scripts/deploy.sh
```

## Phase 2 setup (Firebase + PDS admin)

The Phase 2 endpoints (`/v1/atproto/createAccount`, `/v1/atproto/getSession`)
need additional configuration beyond Phase 1:

### 1. Firebase service account

Generate a service account JSON in the Firebase Console:

- Project: `fuzex-41211`
- Roles: `Firebase Authentication Admin`, `Cloud Datastore User` (Firestore reads)

Copy it to the VPS (mode 600):

```bash
scp ~/path/to/fuzex-dev-service-account.json \
  fuzex-pds-dev:/opt/fuzex-social/api/firebase-service-account.json
ssh fuzex-pds-dev 'chmod 600 /opt/fuzex-social/api/firebase-service-account.json'
```

### 2. Update `.env` on the VPS

Add the Phase 2 variables to `/opt/fuzex-social/api/.env`:

```
FIREBASE_PROJECT_ID=fuzex-41211
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

PDS_ADMIN_USERNAME=admin
PDS_ADMIN_PASSWORD=<from password manager: "Dev PDS — Admin Password">
PDS_INVITE_REQUIRED=true

DEFAULT_WALLET_CHAIN=ethereum
SYNTHETIC_EMAIL_DOMAIN=email.fuzex.app
MIN_USER_AGE=13

# Generate a strong key:
#   openssl rand -base64 48 | tr -d '=+/' | cut -c1-48
PDS_PASSWORD_ENCRYPTION_KEY=<a-strong-48-char-string>
```

Save `PDS_PASSWORD_ENCRYPTION_KEY` in the password manager. Losing it makes
existing encrypted PDS passwords unrecoverable (users would have to re-create
their PDS accounts via Phase 3 reset flow).

### 3. Run the migration

```bash
cd /opt/fuzex-social/api
npm run db:migrate
```

This applies `0001_phase2_user_fields.sql`, adding the new columns to
`users`. The migration is non-destructive — existing rows (e.g. the seeded
`akram`) stay valid; new columns get their defaults.

### 4. Deploy

```bash
bash /opt/fuzex-social/scripts/deploy.sh
```

The deploy script picks up the new env vars and the new code.

### 5. End-to-end verify

From your local machine, with a valid Firebase ID token from the Flutter
app pointed at the dev project:

```bash
curl -i -X POST https://dev-api.fuzex.app/v1/atproto/createAccount \
  -H "Authorization: Bearer <firebase-id-token>"
```

Expected: `201 Created` with `{ did, handle, displayName }`. See
[integration-with-mobile.md](./integration-with-mobile.md) for the full
flow.
