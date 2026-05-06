# Migration: fuzex.app → fuzex.social (Dev VPS)

This playbook documents the manual VPS-side steps needed to complete the
domain migration from `fuzex.app` to `fuzex.social`. Repo-side changes are
already committed; this doc covers the steps the operator must run on the
dev VPS to make the new domain live.

For the rationale, see [ADR 0007](./decisions/0007-migrate-to-fuzex-social-domain.md).

## Prerequisites

Before starting:

- [ ] `fuzex.social` domain owned and managed in Cloudflare
- [ ] Cloudflare DNS records added (DNS only, gray cloud):
  - `dev-api.fuzex.social` → VPS IP
  - `pds.dev.fuzex.social` → VPS IP
  - `*.dev.fuzex.social` → VPS IP
- [ ] `email.fuzex.social` subdomain ready to be added to Resend (separate step)
- [ ] Latest `main` branch pulled on the VPS
- [ ] Snapshot of the dev VPS taken (Hetzner snapshots — optional but recommended)

## Step-by-step

### Step 1 — Verify DNS

```bash
dig +short A dev-api.fuzex.social
dig +short A pds.dev.fuzex.social
dig +short A randomname.dev.fuzex.social   # should also return VPS IP via wildcard
```

All three should return the VPS IPv4. If not, fix Cloudflare records first.

### Step 2 — Backup PDS env and Caddyfile

```bash
ssh fuzex-pds-dev
cp /pds/pds.env /pds/pds.env.before-fuzex-social-$(date +%Y%m%d-%H%M)
cp /pds/caddy/etc/caddy/Caddyfile /pds/caddy/etc/caddy/Caddyfile.before-fuzex-social-$(date +%Y%m%d-%H%M)
ls -la /pds/pds.env* /pds/caddy/etc/caddy/Caddyfile*
```

### Step 3 — Update PDS environment

```bash
sed -i 's/^PDS_HOSTNAME=pds\.dev\.fuzex\.app$/PDS_HOSTNAME=pds.dev.fuzex.social/' /pds/pds.env
sed -i 's/^PDS_SERVICE_HANDLE_DOMAINS=\.dev\.fuzex\.app$/PDS_SERVICE_HANDLE_DOMAINS=.dev.fuzex.social/' /pds/pds.env

grep -E '^(PDS_HOSTNAME|PDS_SERVICE_HANDLE_DOMAINS)' /pds/pds.env
```

Expected output:

```
PDS_HOSTNAME=pds.dev.fuzex.social
PDS_SERVICE_HANDLE_DOMAINS=.dev.fuzex.social
```

Restart PDS:

```bash
cd /pds && docker compose restart pds
sleep 5
docker logs pds --tail 20
```

Look for `pds has started` with no errors.

### Step 4 — Delete akram's account

The existing akram has handle `akram.dev.fuzex.app` which no longer matches
the new PDS handle domain. Cleanest path: delete and recreate.

```bash
ADMIN_PWD=$(grep ^PDS_ADMIN_PASSWORD /pds/pds.env | cut -d= -f2)

# Confirm akram's DID
docker exec pds goat pds admin account list \
  --admin-password "$ADMIN_PWD" 2>/dev/null

# Delete akram
docker exec pds goat pds admin account delete \
  --admin-password "$ADMIN_PWD" \
  --did did:plc:cwbqnunxsu7isx4vv4zul4un

unset ADMIN_PWD
```

Note: deleting an atproto account also broadcasts the deletion via the
relay. Bluesky's AppView will eventually drop the cached profile.

### Step 5 — Drop akram from Postgres

```bash
sudo -u postgres psql -d fuzex_social -c \
  "DELETE FROM users WHERE username = 'akram';"
```

### Step 6 — Pull latest repo and update Caddyfile

```bash
cd /opt/fuzex-social
git pull

# Verify the new Caddyfile looks right
cat /opt/fuzex-social/infrastructure/caddy/Caddyfile.dev

# Install
cp /opt/fuzex-social/infrastructure/caddy/Caddyfile.dev \
   /pds/caddy/etc/caddy/Caddyfile

# Validate
docker exec caddy caddy validate --config /etc/caddy/Caddyfile

# Reload (zero downtime)
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
sleep 5
docker logs caddy --tail 30
```

### Step 7 — Update fuzex-api .env

```bash
nano /opt/fuzex-social/api/.env
```

Update these specific lines:

```
HANDLE_DOMAIN=.dev.fuzex.social
PDS_URL=https://pds.dev.fuzex.social
SYNTHETIC_EMAIL_DOMAIN=email.fuzex.social
```

Save (Ctrl+O, Enter, Ctrl+X).

### Step 8 — Restart fuzex-api

```bash
pm2 restart fuzex-api
sleep 3
pm2 status
curl -s http://localhost:3001/health
```

`pm2 restart` (not `reload`) is required after env changes — `reload` would
keep the old env loaded in the running process.

### Step 9 — Re-seed akram with new handle

The seed script in the repo already targets the new handle:

```bash
sudo -u postgres psql -d fuzex_social -f /opt/fuzex-social/scripts/seed-akram.sql
```

Verify:

```bash
sudo -u postgres psql -d fuzex_social -c \
  "SELECT username, handle, did FROM users WHERE username = 'akram';"
```

Expected: `akram | akram.dev.fuzex.social | did:plc:...`

NOTE: re-seeding with the same DID lets you preserve federation continuity
for akram. If you're starting fully fresh, delete from Postgres and let
`createAccount` generate a new DID via the mobile signup flow.

### Step 10 — Verify end-to-end

From the VPS:

```bash
curl -s http://localhost:3000/xrpc/_health
curl -s http://localhost:3001/health
curl -k -i https://pds.dev.fuzex.social/xrpc/_health 2>&1 | head -5
curl -k -i https://dev-api.fuzex.social/health 2>&1 | head -5
curl -k -i https://akram.dev.fuzex.social/.well-known/atproto-did 2>&1 | head -10
```

All should return 200 with expected payloads.

From your local machine (no `-k`):

```bash
curl -i https://dev-api.fuzex.social/health
curl -s https://dev-api.fuzex.social/v1/resolve/akram.dev.fuzex.social | jq .
curl -s https://akram.dev.fuzex.social/.well-known/atproto-did
```

### Step 11 — Verify Bluesky federation

```bash
curl "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=akram.dev.fuzex.social"
```

May take 5-30 minutes for Bluesky's relay to discover the new hostname.
Eventually returns: `{"did":"did:plc:cwbqnunxsu7isx4vv4zul4un"}`.

### Step 12 — Add Resend domain `email.fuzex.social`

In Resend console:

1. Add new domain: `email.fuzex.social`
2. Verify via Cloudflare Domain Connect (one-click MX/DKIM/SPF)
3. Generate new API key scoped to `email.fuzex.social`
4. Save in password manager: "Resend API Key (FuzeX Social PDS SMTP)"

Update `/pds/pds.env` with new SMTP credentials:

```
PDS_EMAIL_SMTP_URL=smtps://resend:<NEW_API_KEY>@smtp.resend.com:465
PDS_EMAIL_FROM_ADDRESS=noreply@email.fuzex.social
```

Restart PDS:

```bash
cd /pds && docker compose restart pds
```

### Step 13 — Cleanup old DNS (after 7-14 days)

After the new domain is stable and no traffic hits the old hostnames,
remove from Cloudflare:

- `dev-api.fuzex.app`
- `*.dev.fuzex.app`
- `pds.dev.fuzex.app`

Or keep them as inert records — they cost nothing.

### Step 14 — Set up `fuzex.social` root redirect (optional)

In Cloudflare:

1. Add a "Redirect Rules" rule:
   - When: `(http.host eq "fuzex.social")`
   - Then: dynamic redirect to `https://fuzex.app`, status 301
2. This way, anyone who visits `https://fuzex.social` lands on the marketing site.

## Rollback

If anything breaks during migration, restore from backups:

```bash
cp /pds/pds.env.before-fuzex-social-<timestamp> /pds/pds.env
cp /pds/caddy/etc/caddy/Caddyfile.before-fuzex-social-<timestamp> \
   /pds/caddy/etc/caddy/Caddyfile

cd /pds && docker compose restart pds
docker exec caddy caddy reload --config /etc/caddy/Caddyfile

# Restore .env on /opt/fuzex-social/api/.env if needed (no automated backup;
# rebuild from notes or use `git diff` against the committed defaults)
pm2 restart fuzex-api
```

## Production migration

For the production VPS (when provisioned), the equivalent settings are:

- `PDS_HOSTNAME=pds.fuzex.social`
- `PDS_SERVICE_HANDLE_DOMAINS=.fuzex.social`
- API at `api.fuzex.social`
- User handles at `username.fuzex.social`

See [`production-vps-setup.md`](./production-vps-setup.md) for the full
production playbook (already updated with these new hostnames).
