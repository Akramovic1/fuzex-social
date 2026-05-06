# Caddy configuration

This directory holds the Caddyfile that the dev VPS uses to reverse-proxy
the Bluesky PDS and fuzex-api.

## Files

| File | Purpose |
|---|---|
| `Caddyfile.dev` | Caddy config for the dev VPS (`pds.dev.fuzex.social`, `dev-api.fuzex.social`, `*.dev.fuzex.social`) |

## How Caddy is wired on the VPS

The VPS runs Caddy via Docker (installed by the Bluesky PDS installer). Its
config file lives at `/pds/caddy/etc/caddy/Caddyfile`. Reloading Caddy:

```bash
docker compose -f /pds/compose.yaml restart caddy
```

Or, to reload without restarting (zero-downtime):

```bash
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

## Routing rules

The Caddyfile defines three site blocks plus a global block:

1. **Global**: sets the email for Let's Encrypt and the `on_demand_tls` ask hook.
   The `ask` endpoint is the PDS's `/tls-check` route, which approves cert
   issuance for any domain the PDS knows about.
2. **PDS** (`pds.dev.fuzex.social`, `*.pds.dev.fuzex.social`): reverse-proxies to
   port 3000 (the PDS).
3. **fuzex-api** (`dev-api.fuzex.social`): reverse-proxies to port 3001 (fuzex-api).
   Used for `/health`, `/v1/resolve/:handle`, and future endpoints. We set
   `Host`, `X-Real-IP`, `X-Forwarded-*` headers so fuzex-api can inspect the
   real client.
4. **Handle subdomains** (`*.dev.fuzex.social`): match any user handle subdomain
   like `akram.dev.fuzex.social`. Routes only `/.well-known/atproto-did` to
   fuzex-api (which looks up the user by Host header). All other paths return
   404 — handle subdomains are NOT a general API surface.

## Deploying changes

When updating this file:

```bash
# 1. Backup current config on VPS
ssh root@<vps-ip> "cp /pds/caddy/etc/caddy/Caddyfile /pds/caddy/etc/caddy/Caddyfile.backup-$(date +%Y%m%d-%H%M)"

# 2. Copy the new Caddyfile
scp infrastructure/caddy/Caddyfile.dev root@<vps-ip>:/pds/caddy/etc/caddy/Caddyfile

# 3. Validate (in a Docker container) before reloading
ssh root@<vps-ip> "docker exec caddy caddy validate --config /etc/caddy/Caddyfile"

# 4. Reload
ssh root@<vps-ip> "docker exec caddy caddy reload --config /etc/caddy/Caddyfile"

# 5. Smoke test from your local machine
curl https://dev-api.fuzex.social/health
curl -H "Host: akram.dev.fuzex.social" https://akram.dev.fuzex.social/.well-known/atproto-did
```

## Rolling back

If anything breaks after a Caddy reload:

```bash
ssh root@<vps-ip> "cp /pds/caddy/etc/caddy/Caddyfile.backup-<timestamp> /pds/caddy/etc/caddy/Caddyfile"
ssh root@<vps-ip> "docker exec caddy caddy reload --config /etc/caddy/Caddyfile"
```
