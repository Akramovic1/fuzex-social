# Operations

Day-2 runbook for fuzex-api on the VPS.

## Logs

### Application logs (pm2)

```bash
# Live tail
pm2 logs fuzex-api

# Last 100 lines
pm2 logs fuzex-api --lines 100 --nostream

# Errors only
pm2 logs fuzex-api --err
```

Logs also persist to:
- `/opt/fuzex-social/api/logs/out.log`
- `/opt/fuzex-social/api/logs/error.log`

### Caddy logs

```bash
docker logs caddy --tail 100 -f
```

### Postgres logs

```bash
journalctl -u postgresql -n 100 --no-pager
```

## Process control

```bash
# Status
pm2 status

# Restart (downtime)
pm2 restart fuzex-api

# Reload (zero-downtime — preferred)
pm2 reload fuzex-api --update-env

# Stop
pm2 stop fuzex-api

# Remove from pm2 (also removes from startup)
pm2 delete fuzex-api
```

## Health checks

```bash
# Local (on VPS)
curl http://localhost:3001/health

# Public (from anywhere)
curl https://dev-api.fuzex.app/health
```

A healthy response:

```json
{
  "status": "ok",
  "uptime": 12345,
  "version": "0.1.0",
  "timestamp": "2026-01-15T12:00:00.000Z",
  "db": "ok"
}
```

If `status: "degraded"` or `db: "down"`, check Postgres:

```bash
systemctl status postgresql
sudo -u postgres psql -d fuzex_social -c "SELECT 1;"
```

## Database

### Backup (manual, Phase 1)

```bash
sudo -u postgres pg_dump fuzex_social > /tmp/fuzex_social-$(date +%Y%m%d-%H%M).sql
# Move off-server (recommended)
scp /tmp/fuzex_social-*.sql backup-host:/backups/fuzex/
```

### Restore

```bash
sudo -u postgres psql -d fuzex_social < /tmp/fuzex_social-YYYYMMDD-HHMM.sql
```

### Disk usage

```bash
sudo -u postgres psql -d fuzex_social -c "
SELECT pg_size_pretty(pg_database_size('fuzex_social')) AS db_size;
"
```

### Recent activity

```bash
sudo -u postgres psql -d fuzex_social -c "
SELECT count(*) FROM users;
SELECT action, count(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY action ORDER BY count DESC;
"
```

## Common issues

### `/health` returns `{"db":"down"}`

1. Is Postgres running? `systemctl status postgresql`
2. Does the API have the right DATABASE_URL? `cat /opt/fuzex-social/api/.env`
3. Can you connect manually? `sudo -u postgres psql -d fuzex_social -c "SELECT 1;"`

### Bluesky says "Invalid Handle"

1. Curl the well-known directly: `curl -i https://akram.dev.fuzex.app/.well-known/atproto-did`
   - Should return 200 with DID body, no trailing newline
2. Verify the user is in Postgres: `sudo -u postgres psql -d fuzex_social -c "SELECT username, did FROM users WHERE handle = 'akram.dev.fuzex.app';"`
3. AppView caches negative results for ~1 hour. Wait or sign out + back in
4. Check Caddy logs for the request: `docker logs caddy --tail 50 | grep akram`

### pm2 won't start the service

1. Check the build succeeded: `ls -la /opt/fuzex-social/api/dist/`
2. Check .env exists and is readable: `ls -la /opt/fuzex-social/api/.env`
3. Try running directly: `cd /opt/fuzex-social/api && node dist/index.js`
   - The error message will be much clearer than what pm2 shows

### Disk filling up

```bash
df -h /
du -sh /var/lib/postgresql/16
du -sh /opt/fuzex-social/api/logs
```

If logs are large, rotate them:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 5
```

## Updating dependencies

In a feature branch on your local machine:

```bash
cd api
npm outdated
npm update
npm audit fix
npm test
```

Test thoroughly, then PR + merge. Deploy normally.

## Phase 2 hardening (future work)

- Run pm2 as a dedicated `fuzex` user instead of root
- Set up automated nightly Postgres backups to off-server storage
- Add UptimeRobot or similar for /health monitoring
- Add Sentry for error tracking
- Add Postgres connection pooling via PgBouncer if connection count grows
- Add Redis cache for the resolver endpoint if measured latency requires it
