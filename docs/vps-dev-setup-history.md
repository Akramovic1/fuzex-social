# Dev VPS Setup History

This document records the actual journey of provisioning **`fuzex-pds-dev`**, the
dev VPS that hosts the Bluesky PDS and (after Phase 1 deployment) `fuzex-api`.
It is **historical and narrative** — including dead ends and lessons learned.

For a clean step-by-step playbook for provisioning a new VPS, see
[production-vps-setup.md](./production-vps-setup.md).

## Snapshot of the dev VPS

| Property | Value |
|---|---|
| Provider | Hetzner Cloud |
| Type | CX23 (Cost-Optimized, AMD) |
| Region | Nuremberg (NBG1) |
| OS | Ubuntu 24.04 LTS |
| Hostname | `fuzex-pds-dev` |
| IPv4 | (private — saved in password manager) |
| IPv6 | enabled |
| Backups | none (dev only) |
| Cost | ~$5.59/mo (incl. IPv4) |

## Step 1 — Provisioning

### What we did

1. Created a Hetzner project for FuzeX
2. Generated an SSH key locally: `ssh-keygen -t ed25519 -C "fuzex-pds-dev" -f ~/.ssh/fuzex-dev -N ""`
3. Added the public key to Hetzner's key store
4. Provisioned a server:
   - Type: **CX23** (Cost-Optimized)
   - Image: Ubuntu 24.04
   - Location: Nuremberg (NBG1)
   - Networking: IPv4 + IPv6
   - Backups: off
   - Name: `fuzex-pds-dev`

### Dead ends / lessons

- **CX naming confusion**: We almost picked CX22, but Hetzner's current naming is CX23/CX33/CX43/CX53. The `CPX` line is AMD-based, the `CX` line is Intel/AMD generic — for our load, CX23 is fine.
- **Cost-Optimized only available in Nuremberg**: That's not a problem since our users are mostly in MENA/EU and Nuremberg has good latency to both. Just be aware of it for production planning.
- **"Limited availability" warning**: Don't panic. It's not deprecated — it's just a smaller pool of these instances. Easy to provision; we got ours immediately.

### Local SSH config

Added an alias for convenience:

```
# ~/.ssh/config
Host fuzex-pds-dev
    HostName <vps-ip>
    User root
    IdentityFile ~/.ssh/fuzex-dev
```

After this, `ssh fuzex-pds-dev` connects directly.

## Step 2 — OS hardening

### What we did

```bash
# Updates
apt update && apt full-upgrade -y

# Timezone
timedatectl set-timezone UTC

# Hostname
hostnamectl set-hostname fuzex-pds-dev

# Firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# fail2ban
apt install -y fail2ban
cat > /etc/fail2ban/jail.d/sshd.local <<EOF
[sshd]
enabled = true
port = ssh
maxretry = 3
findtime = 600
bantime = 3600
EOF
systemctl enable --now fail2ban

# SSH key-only
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl restart sshd

# Auto security updates
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### Lessons

- **Verify SSH key access in a separate terminal BEFORE disabling password auth**. We did, and we recommend you do too. If `ssh fuzex-pds-dev` works in a second window, you're safe.
- **Reboot deferred**: Ubuntu flagged "*** System restart required ***" after kernel updates. We deferred the reboot until a stable point — fine in practice, just remember to do it.

## Step 3 — Cloudflare DNS

### What we did

The `fuzex.app` zone was already on Cloudflare. We added 3 records:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `pds.dev` | `<vps-ip>` | DNS only (gray cloud) |
| A | `api.dev` | `<vps-ip>` | DNS only (gray cloud) |
| A | `*.dev` | `<vps-ip>` | DNS only (gray cloud) |

We also created a scoped Cloudflare API token:

- Permissions: `Zone:DNS:Edit`
- Zone resources: `Include:Specific zone:fuzex.app`

Saved in password manager as **"Cloudflare API Token (fuzex.app DNS)"**.

### Why DNS only (gray cloud) for everything

Atproto and Caddy's on-demand TLS need the real client IP and the real Host
header. Cloudflare's proxy mode rewrites both, breaking handle verification.
**All atproto-related records MUST be gray cloud.**

The wildcard `*.dev.fuzex.app` is what enables user handles like
`akram.dev.fuzex.app` without per-user DNS records. Specific records (`pds.dev`,
`api.dev`) take priority over the wildcard for those subdomains.

## Step 4 — Resend (email for PDS)

### What we did

The PDS sends email (signup confirmations, password resets). We used Resend.

1. Created a Resend account
2. Added domain `email.fuzex.app` (subdomain to keep email reputation isolated from main domain)
3. Verified via Cloudflare Domain Connect (one-click; auto-created MX, DKIM, SPF records)
4. Created API key scoped to **sending only**, **only on `email.fuzex.app`**

Saved API key in password manager as **"Resend API Key (FuzeX PDS SMTP)"**.

## Step 5 — Bluesky PDS install

### What we did

Followed the official Bluesky installer:

```bash
ssh fuzex-pds-dev
wget https://raw.githubusercontent.com/bluesky-social/pds/main/installer.sh
bash installer.sh
```

The installer prompts for:
- Domain name → `pds.dev.fuzex.app`
- Email → `tech@fuzex.io`

It installs Docker, generates secrets (admin password, JWT secret, PLC rotation key), and starts three containers: `pds`, `caddy`, `watchtower`.

### What we modified after install

The installer's defaults don't quite match our setup. We added env vars:

```bash
echo 'PDS_SERVICE_HANDLE_DOMAINS=.dev.fuzex.app' >> /pds/pds.env
echo 'PDS_INVITE_REQUIRED=true' >> /pds/pds.env

# SMTP via Resend
cat >> /pds/pds.env <<EOF
PDS_EMAIL_SMTP_URL=smtps://resend:<RESEND_API_KEY>@smtp.resend.com:465
PDS_EMAIL_FROM_ADDRESS=noreply@email.fuzex.app
EOF

cd /pds && docker compose restart pds
```

### Critical secrets to save

The installer wrote these to `/pds/pds.env`. Save in password manager:

- `PDS_ADMIN_PASSWORD` — used for admin operations (creating accounts, managing invites)
- `PDS_JWT_SECRET` — internal token signing
- `PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX` — **irreplaceable**. Losing this means losing PDS recovery ability for all accounts on this PDS

## Step 6 — Test account creation

### What we did

```bash
# On the VPS, via the goat CLI (bundled with the installer)
docker exec pds goat pds admin account create \
  --admin-password "$(grep ^PDS_ADMIN_PASSWORD /pds/pds.env | cut -d= -f2)" \
  --handle akram.dev.fuzex.app \
  --email akram@fuzex.io \
  --password 'StrongTestPassword123!'
```

This created:
- Handle: `akram.dev.fuzex.app`
- DID: `did:plc:cwbqnunxsu7isx4vv4zul4un`

### Dead ends / lessons

- **First attempt with handle `admin.dev.fuzex.app` failed**. PDS hardcodes reserved handles: `admin`, `support`, `help`, `mod`, `staff`. None of these can be account handles even on your own PDS.
- **`goat` is the modern CLI**. Older docs reference `pdsadmin.sh`. Use `goat pds admin account create` instead.
- **No `--invite-code` flag on `account create`**. The subcommand auto-generates an invite internally. Trying to pass `--invite-code` errors out.
- **`--password` is required** in this version of `goat` — no auto-generation. Generate a strong password yourself, save it, then pass it.

## Step 7 — Federation verification (the long road)

This took longer than expected. Documented here so future-you doesn't repeat the debugging.

### The symptom

After creating the account, `bsky.app/profile/akram.dev.fuzex.app` showed
**"Invalid Handle"**.

### What we tried that didn't work

1. **Hoping it was just AppView cache**. We waited; it persisted.
2. **Adding `*.dev.fuzex.app` reverse_proxy to PDS**. Caddy now served the `/.well-known/atproto-did` endpoint by routing it to PDS. Curl returned a 200, but with the WRONG body:
   ```
   curl -i https://akram.dev.fuzex.app/.well-known/atproto-did
   # Body: "akram.dev.fuzex.app"   ← that's the handle, not the DID
   ```
   PDS's built-in well-known endpoint only knows how to answer for its own
   host. For arbitrary subdomains routed via reverse proxy, it returned the
   handle string, not the DID.

### What worked

A temporary Caddy hardcode for the test account:

```
akram.dev.fuzex.app {
  tls { on_demand }
  handle /.well-known/atproto-did {
    header Content-Type "text/plain"
    respond "did:plc:cwbqnunxsu7isx4vv4zul4un" 200
  }
  handle { respond 404 }
}
```

After reload, curl returned the correct DID with no trailing newline.
Bluesky's `resolveHandle` API confirmed validity:

```bash
curl "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=akram.dev.fuzex.app"
# {"did":"did:plc:cwbqnunxsu7isx4vv4zul4un"}
```

We then posted to bsky.app from the test account. The post federated.

### Why this is a *temporary* hardcode

The hardcode only works for `akram`. Every new user would need a manual
Caddy edit, which is unacceptable. The proper fix is `fuzex-api` — when
it deploys, it serves `/.well-known/atproto-did` for ALL handle subdomains
by querying Postgres for the user's DID. The Caddy block becomes a wildcard
reverse_proxy to fuzex-api.

That replacement is what `infrastructure/caddy/Caddyfile.dev` in this repo does.

### Lessons

- **bsky.app's UI cache is aggressive** — even after fixing the well-known
  endpoint, the "Invalid Handle" badge can persist up to ~1 hour. The
  `resolveHandle` API is the source of truth for whether the handle is
  actually valid.
- **The well-known body MUST be the DID with NO trailing newline**. Strict
  parsers reject the slightest extra byte.

## Step 8 — fuzex-api prerequisites on the VPS

After confirming federation, we installed everything fuzex-api needs:

```bash
# Node 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# pm2
npm install -g pm2

# PostgreSQL 16 from the postgres apt repo
sh -c "echo 'deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main' > /etc/apt/sources.list.d/pgdg.list"
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
apt update
apt install -y postgresql-16
systemctl enable --now postgresql

# Create DB + user (interactively, with a strong password)
sudo -u postgres psql <<'EOF'
CREATE DATABASE fuzex_social;
CREATE USER fuzex_api WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
ALTER DATABASE fuzex_social OWNER TO fuzex_api;
GRANT ALL PRIVILEGES ON DATABASE fuzex_social TO fuzex_api;
\c fuzex_social
GRANT ALL ON SCHEMA public TO fuzex_api;
EOF

# GitHub deploy key
ssh-keygen -t ed25519 -C "fuzex-pds-dev-deploy" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
# Add the printed key as a READ-ONLY deploy key on Akramovic1/fuzex-social

# SSH config for github
cat >> ~/.ssh/config <<'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy
    IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

# App directory
mkdir -p /opt/fuzex-social

# Verify github access
ssh -T git@github.com   # should say "Hi Akramovic1/fuzex-social!"
```

The Postgres password is saved in password manager as **"FuzeX Dev VPS Postgres Password"**.

> Note: This sequence is exactly what
> [`scripts/setup-vps.sh`](../scripts/setup-vps.sh) automates idempotently.
> A future fresh VPS would run that script instead of doing this by hand.

## What's next on this VPS

Following [deployment.md](./deployment.md), the next step is to:

1. Clone the repo into `/opt/fuzex-social`
2. Configure `api/.env`
3. Run `bash /opt/fuzex-social/scripts/deploy.sh`
4. Replace the Caddy hardcode with `infrastructure/caddy/Caddyfile.dev`
5. Seed `akram` from `scripts/seed-akram.sql`

After that, fuzex-api takes over handle resolution and the temporary hardcode
is gone.

## Credentials saved to password manager

For a clean record, here's everything from this setup that lives in our
password manager:

- Hetzner Cloud (account login)
- Cloudflare (account login)
- Cloudflare API Token (fuzex.app DNS)
- Hetzner Dev VPS — SSH private key path
- Hetzner Dev VPS — root password (auto-set by Hetzner; rarely needed since key auth is on)
- Resend (account login)
- Resend API Key (FuzeX PDS SMTP)
- Dev PDS — Admin Password (`PDS_ADMIN_PASSWORD`)
- Dev PDS — JWT Secret (`PDS_JWT_SECRET`)
- Dev PDS — PLC Rotation Key (`PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX`)
- Dev PDS — Test account `akram@fuzex.io` password
- FuzeX Dev VPS — Postgres password
- GitHub — Deploy key (kept on VPS at `~/.ssh/github_deploy`; public key added to repo)
