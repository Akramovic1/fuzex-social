#!/usr/bin/env bash
#
# deploy.sh — Idempotent deploy of fuzex-api on the VPS.
#
# Pulls latest code, installs deps, runs migrations, reloads pm2.
# Performs a smoke test against /health before returning success.
#
# Run as root on the VPS:
#   bash /opt/fuzex-social/scripts/deploy.sh

set -euo pipefail

readonly APP_DIR="/opt/fuzex-social"
readonly API_DIR="$APP_DIR/api"
readonly BRANCH="${DEPLOY_BRANCH:-main}"
readonly PM2_APP_NAME="fuzex-api"
readonly HEALTH_URL="http://localhost:3001/health"
readonly HEALTH_TIMEOUT_S=15

log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[err]\033[0m %s\n' "$*" >&2; }

ensure_repo() {
  if [[ ! -d "$APP_DIR/.git" ]]; then
    err "expected a git repository at $APP_DIR"
    err "clone it first: git clone git@github.com:Akramovic1/fuzex-social.git $APP_DIR"
    exit 1
  fi
}

pull_latest() {
  log "pulling branch $BRANCH"
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  ok "at $(git rev-parse --short HEAD)"
}

install_deps() {
  log "installing dependencies (npm ci)"
  cd "$API_DIR"
  npm ci
  ok "dependencies installed"
}

build() {
  log "building TypeScript"
  cd "$API_DIR"
  npm run build
  ok "build complete (dist/ ready)"
}

run_migrations() {
  log "running database migrations"
  cd "$API_DIR"
  if [[ ! -f .env ]]; then
    err "$API_DIR/.env not found — copy .env.example and set DATABASE_URL"
    exit 1
  fi
  npm run db:migrate
  ok "migrations applied"
}

reload_or_start_pm2() {
  cd "$API_DIR"
  if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    log "reloading $PM2_APP_NAME (zero-downtime)"
    pm2 reload "$PM2_APP_NAME" --update-env
  else
    log "starting $PM2_APP_NAME for the first time"
    pm2 start ecosystem.config.cjs
    pm2 save
    log "configuring pm2 to start on boot"
    pm2 startup systemd -u root --hp /root | tail -1 | bash || true
  fi
  ok "pm2 status:"
  pm2 status
}

smoke_test() {
  log "smoke testing $HEALTH_URL (timeout ${HEALTH_TIMEOUT_S}s)"
  local elapsed=0
  local response=""
  while (( elapsed < HEALTH_TIMEOUT_S )); do
    if response=$(curl -fsS --max-time 3 "$HEALTH_URL" 2>/dev/null); then
      ok "health endpoint responded: $response"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  err "smoke test failed — /health did not respond within ${HEALTH_TIMEOUT_S}s"
  err "recent pm2 logs:"
  pm2 logs "$PM2_APP_NAME" --lines 50 --nostream || true
  exit 1
}

main() {
  log "starting deploy"
  ensure_repo
  pull_latest
  install_deps
  build
  run_migrations
  reload_or_start_pm2
  smoke_test
  ok "deploy complete"
}

main "$@"
