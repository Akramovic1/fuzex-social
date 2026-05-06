# Production VPS Setup

This is the playbook for provisioning the **production** VPS that hosts the
Bluesky PDS and `fuzex-api` for `fuzex.app`.

It builds on the dev experience but adds the hardening dev skipped: a dedicated
non-root user, automated backups, monitoring, stricter rate limits, and tighter
firewall.

For the dev VPS history (which dead ends were hit, what we learned), see
[vps-dev-setup-history.md](./vps-dev-setup-history.md).

## Production target

| Property | Value |
|---|---|
| Provider | Hetzner Cloud |
| Type | CX33 or larger (more headroom than dev's CX23) |
| Region | Nuremberg (NBG1) — same region as dev to keep latency model consistent |
| OS | Ubuntu 24.04 LTS |
| Hostname | `fuzex-pds-prod` |
| Backups | Hetzner snapshots ENABLED (~$1/mo) |
| IPv4 | dedicated |
| IPv6 | enabled |

Why CX33 over CX23: Postgres + PDS + fuzex-api on the same box benefits from
extra RAM. Cost difference is ~$3/mo. Worth it for production.

## Domain plan

Production uses the bare `fuzex.app` zone with these new records:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `pds` | `<prod-vps-ip>` | DNS only (gray cloud) |
| A | `api` | `<prod-vps-ip>` | DNS only (gray cloud) |
| A | `*` (wildcard) | `<prod-vps-ip>` | DNS only (gray cloud) |

User handles look like `username.fuzex.app` instead of dev's `username.dev.fuzex.app`.

⚠️ **Existing records that MUST be preserved**: anything currently on
`fuzex.app` (the marketing site, app subdomain, email/SMTP records, etc.).
The wildcard does NOT override specific records, but verify no critical
records collide before adding the wildcard.

## Pre-provisioning checklist

Before pressing "Create Server" on Hetzner:

- [ ] Production passwords/keys NOT yet generated (do this on the server, never in browser)
- [ ] DNS plan reviewed — no conflicts with existing `fuzex.app` records
- [ ] Cloudflare API token for `fuzex.app` DNS Edit ready (can reuse the dev one if scoped to the whole zone)
- [ ] Resend production domain decision made (recommended: `email.fuzex.app` is reused for prod, OR a separate `mail.fuzex.app`)
- [ ] Backblaze B2 (or alternative off-server backup target) account created
- [ ] UptimeRobot account created
- [ ] Sentry project created (optional but recommended for prod)

## Step 1 — Provision the VPS

In Hetzner console:

1. Create a new server in the FuzeX project
2. Type: **CX33** (or larger if expecting heavy load)
3. Image: Ubuntu 24.04
4. Region: Nuremberg (NBG1)
5. Networking: IPv4 + IPv6
6. **Backups: ON**
7. Name: `fuzex-pds-prod`
8. SSH key: a NEW key (do NOT reuse the dev key)

Generate the SSH key locally first:

```bash
ssh-keygen -t ed25519 -C "fuzex-pds-prod" -f ~/.ssh/fuzex-prod -N ""
```

Add the public key (`~/.ssh/fuzex-prod.pub`) to Hetzner BEFORE creating the server.

After provisioning, save the public IP in password manager as **"Hetzner Prod VPS IP"**.

Add to `~/.ssh/config`:

```
Host fuzex-pds-prod
    HostName <prod-vps-ip>
    User root
    IdentityFile ~/.ssh/fuzex-prod
```

## Step 2 — OS hardening (production-grade)

### 2.1 Updates and basics

```bash
ssh fuzex-pds-prod
apt update && apt full-upgrade -y
timedatectl set-timezone UTC
hostnamectl set-hostname fuzex-pds-prod
```

### 2.2 Create the dedicated `fuzex` user

Production should NOT run pm2 as root. Create a system user that owns
the application directory and runs the process.

```bash
adduser --disabled-password --gecos "" fuzex
usermod -aG sudo fuzex   # for occasional admin tasks; consider removing after deploy is automated

# Copy your SSH key to the fuzex user
mkdir -p /home/fuzex/.ssh
cp ~/.ssh/authorized_keys /home/fuzex/.ssh/authorized_keys
chown -R fuzex:fuzex /home/fuzex/.ssh
chmod 700 /home/fuzex/.ssh
chmod 600 /home/fuzex/.ssh/authorized_keys
```

Verify: `ssh fuzex@<prod-vps-ip>` works in a separate terminal **before**
proceeding to the next step.

### 2.3 Restrict SSH

```bash
# Disable password auth and root login
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl restart sshd
```

`prohibit-password` allows root with key (needed for some deploy operations)
but blocks password root login entirely.

### 2.4 Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Optional further restriction (recommended once deploys are automated): limit
SSH to specific IPs.

```bash
ufw delete allow 22/tcp
ufw allow from <your-office-or-vpn-ip> to any port 22 proto tcp
```

### 2.5 fail2ban

```bash
apt install -y fail2ban
cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
port = ssh
maxretry = 3
findtime = 600
bantime = 3600
EOF
systemctl enable --now fail2ban
```

### 2.6 Auto security updates

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### 2.7 Disable atime, enable swap (minor perf)

```bash
# Reduce disk wear — atime updates aren't useful for our workload
sed -i 's/errors=remount-ro/errors=remount-ro,noatime/' /etc/fstab
mount -o remount /

# Swap (helps Postgres if memory pressure spikes briefly)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl vm.swappiness=10
echo 'vm.swappiness=10' > /etc/sysctl.d/99-fuzex.conf
```

## Step 3 — DNS setup

In Cloudflare:

1. Add `pds`, `api`, and `*` (wildcard) A records pointing to the prod VPS IP
2. Verify all three are **DNS only (gray cloud)**

```bash
# From your local machine, verify
dig +short A pds.fuzex.app
dig +short A api.fuzex.app
dig +short A randomname.fuzex.app   # should also return the VPS IP via wildcard
```

## Step 4 — Resend for production email

Either:
- **Reuse `email.fuzex.app`** if your dev/prod don't need separate reputation
- **Add a separate domain** (e.g., `mail.fuzex.app`) for prod-only reputation isolation

Either way, create a NEW API key scoped to production. Save in password
manager as **"Resend API Key (FuzeX Prod PDS SMTP)"**.

## Step 5 — Bluesky PDS install

Same installer as dev:

```bash
ssh fuzex-pds-prod
wget https://raw.githubusercontent.com/bluesky-social/pds/main/installer.sh
bash installer.sh
```

Prompts:
- Domain: `pds.fuzex.app`
- Email: `tech@fuzex.io`

After install, configure for prod handle domain:

```bash
echo 'PDS_SERVICE_HANDLE_DOMAINS=.fuzex.app' >> /pds/pds.env
echo 'PDS_INVITE_REQUIRED=true' >> /pds/pds.env

cat >> /pds/pds.env <<EOF
PDS_EMAIL_SMTP_URL=smtps://resend:<RESEND_PROD_API_KEY>@smtp.resend.com:465
PDS_EMAIL_FROM_ADDRESS=noreply@email.fuzex.app
EOF

cd /pds && docker compose restart pds
```

⚠️ **Save these PDS secrets immediately**:

```bash
grep -E '^(PDS_ADMIN_PASSWORD|PDS_JWT_SECRET|PDS_PLC_ROTATION_KEY)' /pds/pds.env
```

Save in password manager:
- **"Prod PDS — Admin Password"**
- **"Prod PDS — JWT Secret"**
- **"Prod PDS — PLC Rotation Key"**

> The PLC rotation key is **irreplaceable**. Losing it means losing recovery
> ability for every account on this PDS. Back it up to multiple locations.

## Step 6 — fuzex-api prerequisites

Use the idempotent script from this repo:

```bash
git clone https://github.com/Akramovic1/fuzex-social.git /opt/fuzex-social
bash /opt/fuzex-social/scripts/setup-vps.sh
```

This installs Node 20, pm2, PostgreSQL 16, generates a deploy key, and creates `/opt/fuzex-social`.

After it runs, ownership-shift the app dir to the `fuzex` user:

```bash
chown -R fuzex:fuzex /opt/fuzex-social
```

Add the printed deploy public key to GitHub as a **read-only deploy key** on `Akramovic1/fuzex-social`.

## Step 7 — Postgres setup

```bash
nano /opt/fuzex-social/infrastructure/postgres/init.sql
# Replace CHANGE_ME_STRONG_PASSWORD with a real strong password
# Save in password manager as "FuzeX Prod VPS Postgres Password"

sudo -u postgres psql -f /opt/fuzex-social/infrastructure/postgres/init.sql
```

### Tighter Postgres config for prod

```bash
# Edit /etc/postgresql/16/main/postgresql.conf
# Recommended starting values for a single-VPS prod:

sed -i "s/^#\?listen_addresses.*/listen_addresses = 'localhost'/" /etc/postgresql/16/main/postgresql.conf
sed -i "s/^#\?max_connections.*/max_connections = 100/" /etc/postgresql/16/main/postgresql.conf
sed -i "s/^#\?shared_buffers.*/shared_buffers = 1GB/" /etc/postgresql/16/main/postgresql.conf
sed -i "s/^#\?effective_cache_size.*/effective_cache_size = 2GB/" /etc/postgresql/16/main/postgresql.conf
sed -i "s/^#\?work_mem.*/work_mem = 4MB/" /etc/postgresql/16/main/postgresql.conf
sed -i "s/^#\?maintenance_work_mem.*/maintenance_work_mem = 256MB/" /etc/postgresql/16/main/postgresql.conf

systemctl restart postgresql
```

These are starting points for ~4GB RAM. Tune based on actual workload.

## Step 8 — Application configuration

```bash
sudo -u fuzex bash <<'EOF'
cd /opt/fuzex-social/api
cp .env.example .env
chmod 600 .env
EOF
nano /opt/fuzex-social/api/.env
```

Production `.env`:

```
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

DATABASE_URL=postgresql://fuzex_api:THE_PASSWORD@localhost:5432/fuzex_social

# Production handle domain (note: NO 'dev' prefix)
HANDLE_DOMAIN=.fuzex.app
PDS_URL=https://pds.fuzex.app

# Production CORS — only the actual production origins
CORS_ALLOWED_ORIGINS=https://app.fuzex.app,https://fuzex.app

# Tighter rate limits for prod
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
```

## Step 9 — First deploy

```bash
sudo -u fuzex bash /opt/fuzex-social/scripts/deploy.sh
```

The deploy script's pm2 step starts the process. To make it persist across
reboots **as the `fuzex` user**:

```bash
sudo -u fuzex pm2 startup systemd -u fuzex --hp /home/fuzex
# Run the printed `sudo env PATH=... pm2 startup systemd -u fuzex --hp /home/fuzex` command
sudo -u fuzex pm2 save
```

## Step 10 — Caddy update

```bash
# Backup and replace Caddyfile
cp /pds/caddy/etc/caddy/Caddyfile /pds/caddy/etc/caddy/Caddyfile.before-fuzex-api
cp /opt/fuzex-social/infrastructure/caddy/Caddyfile.dev /pds/caddy/etc/caddy/Caddyfile

# IMPORTANT: production uses bare fuzex.app, not dev.fuzex.app
# Edit the Caddyfile to replace 'dev.fuzex.app' with 'fuzex.app' in all 3 site blocks
sed -i 's/\.dev\.fuzex\.app/.fuzex.app/g' /pds/caddy/etc/caddy/Caddyfile
sed -i 's/\bpds\.dev\.fuzex\.app/pds.fuzex.app/g' /pds/caddy/etc/caddy/Caddyfile
sed -i 's/\bapi\.dev\.fuzex\.app/api.fuzex.app/g' /pds/caddy/etc/caddy/Caddyfile

# Validate
docker exec caddy caddy validate --config /etc/caddy/Caddyfile

# Reload (zero-downtime)
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

> A future improvement: maintain a `Caddyfile.prod` in the repo so the sed
> dance isn't needed. Punt for now.

## Step 11 — Backups

### Postgres nightly backup to Backblaze B2

Install rclone:

```bash
apt install -y rclone
rclone config   # configure a 'b2' remote with your B2 keys
```

Backup script at `/opt/fuzex-social/scripts/prod-backup.sh` (create separately, not in this prompt):

```bash
#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M)
BACKUP_DIR=/var/backups/fuzex
mkdir -p "$BACKUP_DIR"

sudo -u postgres pg_dump -Fc fuzex_social > "$BACKUP_DIR/fuzex_social-$TIMESTAMP.dump"
rclone copy "$BACKUP_DIR/fuzex_social-$TIMESTAMP.dump" b2:fuzex-prod-backups/postgres/

find "$BACKUP_DIR" -mtime +7 -delete   # keep 7 local days
```

Cron:

```bash
echo "0 3 * * * /opt/fuzex-social/scripts/prod-backup.sh >> /var/log/fuzex-backup.log 2>&1" | crontab -
```

### Hetzner snapshots

Already enabled in Step 1. Provides full-VPS recovery for catastrophic failures.

### Test the restore

Before claiming backups work, **test a restore** from B2 to a scratch DB.
Run this once a quarter.

## Step 12 — Monitoring

### Health check (UptimeRobot)

Add a monitor:
- URL: `https://api.fuzex.app/health`
- Type: HTTPS
- Interval: 5 minutes
- Alert contact: tech@fuzex.io + a Slack/SMS for high-severity

### SSL expiry monitoring

Add a second UptimeRobot monitor with type "SSL" pointing at
`https://api.fuzex.app`. Caddy auto-renews, but a second pair of eyes is
cheap insurance.

### Application errors (Sentry — optional)

Phase 2 task. Add `@sentry/node` to fuzex-api and configure DSN via env var.

### Disk usage alerts

Add a cron-driven check that emails when `df /` is above 80%.

## Step 13 — Seed the production data

For a fresh production launch, you typically don't seed test users like
`akram`. Instead, the first real users register through the actual signup
flow (which Phase 2 will provide).

If you do need to seed for some reason:

```bash
sudo -u postgres psql -d fuzex_social <<'EOF'
INSERT INTO users (...)
VALUES (...)
ON CONFLICT (username) DO NOTHING;
EOF
```

## Step 14 — Verify

From your local machine:

```bash
curl https://api.fuzex.app/health
curl -i https://<some-real-user>.fuzex.app/.well-known/atproto-did
```

Both should return 200 with expected payloads.

## Production credentials checklist

Save ALL of these in password manager BEFORE moving on:

- Hetzner Prod VPS — IP
- Hetzner Prod VPS — SSH private key path (`~/.ssh/fuzex-prod`)
- Cloudflare API Token — same as dev or new
- Resend Prod API Key
- Prod PDS — Admin Password
- Prod PDS — JWT Secret
- Prod PDS — **PLC Rotation Key** (irreplaceable; back up to a second location)
- FuzeX Prod VPS — Postgres password
- Backblaze B2 — application key
- GitHub deploy key public key (already in repo settings)

## Phase 2 hardening (after production launch)

- Move pm2 to a non-sudoer `fuzex` user (drop the `usermod -aG sudo` from Step 2.2)
- Restrict SSH to office/VPN IPs only
- Add Postgres replica on a second VPS for read failover
- Add PgBouncer if connection count grows
- Add Sentry for error tracking
- Add Postgres slow query log + pg_stat_statements
- Consider Hetzner Load Balancer if going multi-VPS
- Periodic security audit
