# Scripts

Operational scripts for fuzex-api VPS provisioning, deployment, and one-off utilities.

| File | Purpose | Where to run |
|---|---|---|
| `setup-vps.sh` | Idempotent VPS setup (Node 20, pm2, Postgres, deploy key, app dir) | VPS, as root |
| `deploy.sh` | Idempotent deploy (pull, build, migrate, pm2 reload, smoke test) | VPS, as root |
| `seed-akram.sql` | Inserts the test account `akram` (idempotent) | dev or VPS Postgres |

## First-time provisioning workflow

```bash
# 1. SSH to fresh VPS as root
ssh root@<vps-ip>

# 2. Clone and run setup
git clone https://github.com/Akramovic1/fuzex-social.git /opt/fuzex-social
bash /opt/fuzex-social/scripts/setup-vps.sh

# 3. Add the printed deploy public key to GitHub repo settings (read-only)

# 4. Configure Postgres
nano /opt/fuzex-social/infrastructure/postgres/init.sql
# Set CHANGE_ME_STRONG_PASSWORD to a real password (save in password manager)
sudo -u postgres psql -f /opt/fuzex-social/infrastructure/postgres/init.sql

# 5. Configure the API .env
cd /opt/fuzex-social/api
cp .env.example .env
nano .env
# Set DATABASE_URL with the password from step 4
# Set NODE_ENV=production
# Set PORT=3001 (or whatever Caddy will reverse-proxy to)

# 6. First deploy
bash /opt/fuzex-social/scripts/deploy.sh
```

## Subsequent deploys

```bash
ssh root@<vps-ip>
bash /opt/fuzex-social/scripts/deploy.sh
```

To deploy a non-main branch (e.g., a release branch):

```bash
DEPLOY_BRANCH=release/2025-q4 bash /opt/fuzex-social/scripts/deploy.sh
```

## Caddy update

When Caddy config changes (e.g., adding new routes), see `infrastructure/caddy/README.md` for the deploy-and-reload procedure.

## seed-akram.sql

For end-to-end manual verification — inserts a test row matching the existing `akram.dev.fuzex.app` PDS account. Run from the repo root:

```bash
# Local dev DB
docker exec -i fuzex-postgres-dev psql -U fuzex_api_dev -d fuzex_social_dev \
  < scripts/seed-akram.sql

# VPS dev DB
sudo -u postgres psql -d fuzex_social < /opt/fuzex-social/scripts/seed-akram.sql
```
