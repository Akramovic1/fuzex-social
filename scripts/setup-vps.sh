#!/usr/bin/env bash
#
# setup-vps.sh — Idempotent setup of a fuzex-api host on Ubuntu 24.04.
#
# Installs Node 20, pm2, PostgreSQL 16, sets up the app directory, and
# generates a deploy SSH key (if not already present).
#
# Run as root on the VPS:
#   bash setup-vps.sh
#
# Re-running is safe — every step checks for prior completion.

set -euo pipefail

readonly NODE_MAJOR=20
readonly APP_DIR="/opt/fuzex-social"
readonly SSH_KEY_PATH="$HOME/.ssh/github_deploy"
readonly SSH_KEY_COMMENT="fuzex-api-vps-deploy"

log()  { printf '\033[1;34m[setup]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[err]\033[0m %s\n' "$*" >&2; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    err "Must be run as root."
    exit 1
  fi
}

ensure_node() {
  log "checking Node.js"
  if command -v node >/dev/null 2>&1; then
    local current
    current=$(node --version | sed 's/^v//' | cut -d. -f1)
    if [[ "$current" -ge "$NODE_MAJOR" ]]; then
      ok "Node.js $(node --version) already installed"
      return 0
    fi
    warn "Node.js $current is older than required v$NODE_MAJOR; replacing"
  fi
  log "installing Node.js ${NODE_MAJOR}.x via NodeSource"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
  ok "Node.js $(node --version) installed"
}

ensure_pm2() {
  log "checking pm2"
  if command -v pm2 >/dev/null 2>&1; then
    ok "pm2 $(pm2 --version) already installed"
    return 0
  fi
  log "installing pm2 globally"
  npm install -g pm2
  ok "pm2 $(pm2 --version) installed"
}

ensure_postgres() {
  log "checking PostgreSQL"
  if command -v psql >/dev/null 2>&1 && systemctl is-active --quiet postgresql; then
    ok "PostgreSQL already installed and running"
    return 0
  fi
  log "installing PostgreSQL 16 from the postgres apt repo"
  if [[ ! -f /etc/apt/sources.list.d/pgdg.list ]]; then
    sh -c "echo 'deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main' > /etc/apt/sources.list.d/pgdg.list"
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
  fi
  apt-get update
  apt-get install -y postgresql-16
  systemctl enable --now postgresql
  ok "PostgreSQL installed and running"
}

ensure_app_dir() {
  log "ensuring app directory $APP_DIR"
  mkdir -p "$APP_DIR"
  mkdir -p "$APP_DIR/api/logs"
  ok "app directory ready"
}

ensure_deploy_key() {
  log "checking SSH deploy key"
  if [[ -f "$SSH_KEY_PATH" ]]; then
    ok "deploy key already exists at $SSH_KEY_PATH"
  else
    log "generating ed25519 deploy key"
    mkdir -p "$(dirname "$SSH_KEY_PATH")"
    ssh-keygen -t ed25519 -C "$SSH_KEY_COMMENT" -f "$SSH_KEY_PATH" -N ""
    ok "deploy key generated"
  fi

  log "ensuring github.com is in known_hosts"
  if ! ssh-keygen -F github.com >/dev/null 2>&1; then
    ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null
    ok "added github.com to known_hosts"
  else
    ok "github.com already in known_hosts"
  fi

  log "ensuring SSH config routes github.com through deploy key"
  local ssh_config="$HOME/.ssh/config"
  touch "$ssh_config"
  chmod 600 "$ssh_config"
  if ! grep -q "Host github.com" "$ssh_config"; then
    cat >> "$ssh_config" <<EOF
Host github.com
  HostName github.com
  User git
  IdentityFile $SSH_KEY_PATH
  IdentitiesOnly yes
EOF
    ok "SSH config updated"
  else
    ok "SSH config already routes github.com"
  fi
}

print_summary() {
  echo
  echo "================================================================"
  echo "VPS setup complete."
  echo "================================================================"
  echo
  echo "Next steps:"
  echo
  echo "1. Add this public key to GitHub as a deploy key for"
  echo "   Akramovic1/fuzex-social (Settings -> Deploy keys -> Add):"
  echo "   ----------------------------------------------------------------"
  cat "${SSH_KEY_PATH}.pub"
  echo "   ----------------------------------------------------------------"
  echo "   (Read-only access is sufficient. Don't grant write.)"
  echo
  echo "2. Edit infrastructure/postgres/init.sql to set a real password,"
  echo "   then run:"
  echo "     sudo -u postgres psql -f $APP_DIR/infrastructure/postgres/init.sql"
  echo
  echo "3. Clone the repo:"
  echo "     git clone git@github.com:Akramovic1/fuzex-social.git $APP_DIR"
  echo
  echo "4. Configure .env:"
  echo "     cd $APP_DIR/api"
  echo "     cp .env.example .env"
  echo "     nano .env  # set DATABASE_URL with the password from step 2"
  echo
  echo "5. Run the deploy script:"
  echo "     bash $APP_DIR/scripts/deploy.sh"
  echo
}

main() {
  require_root
  log "starting fuzex-api VPS setup"
  ensure_node
  ensure_pm2
  ensure_postgres
  ensure_app_dir
  ensure_deploy_key
  print_summary
}

main "$@"
