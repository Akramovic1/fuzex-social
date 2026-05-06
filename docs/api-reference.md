# API Reference

Phase 1 endpoints. All endpoints are under `https://api.dev.fuzex.app` unless noted.

## GET /health

Liveness check with database ping.

**Auth:** None
**Response:** `application/json`

```bash
curl https://api.dev.fuzex.app/health
```

```json
{
  "status": "ok",
  "uptime": 12345,
  "version": "0.1.0",
  "timestamp": "2026-01-15T12:00:00.000Z",
  "db": "ok"
}
```

| Field | Type | Notes |
|---|---|---|
| `status` | `"ok" \| "degraded"` | `"degraded"` when DB ping fails |
| `uptime` | number | Process uptime in seconds |
| `version` | string | `package.json` version |
| `timestamp` | string | ISO-8601 UTC |
| `db` | `"ok" \| "down"` | DB ping result |

The endpoint always returns 200, even when degraded — 5xx is reserved for
cases where the load balancer should remove the instance.

## GET /.well-known/atproto-did

Resolves a handle to its DID for atproto handle verification.

**Hostname:** Called on user-handle subdomains (e.g., `https://akram.dev.fuzex.app/.well-known/atproto-did`).
The endpoint reads the `Host` header to identify the user.

**Auth:** None (public; called by Bluesky's AppView)

**Response on success:** `text/plain; charset=utf-8`, body is the DID with **no trailing newline**

```bash
curl https://akram.dev.fuzex.app/.well-known/atproto-did
# did:plc:cwbqnunxsu7isx4vv4zul4un
```

| Status | When | Body |
|---|---|---|
| 200 | Handle resolves | DID as plain text |
| 404 | Handle not found, malformed, reserved, or any other resolution failure | empty |

The endpoint deliberately does NOT distinguish between "user does not exist"
and "handle is malformed" — both return 404 with empty body. This prevents
username-existence enumeration.

**Cache:** `Cache-Control: public, max-age=300` on success.

## GET /v1/resolve/:handle

Public tipping resolver. Given a handle, returns the wallet address to tip.

**Auth:** None (public; called by FuzeX clients)
**Response:** `application/json`

```bash
curl https://api.dev.fuzex.app/v1/resolve/akram.dev.fuzex.app
```

```json
{
  "handle": "akram.dev.fuzex.app",
  "did": "did:plc:cwbqnunxsu7isx4vv4zul4un",
  "walletAddress": "0x0000000000000000000000000000000000000001",
  "chain": "ethereum",
  "tippingEnabled": true
}
```

**Cache:** `Cache-Control: public, max-age=60`

### Errors

All errors share the shape:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "human readable",
    "details": { "...": "optional structured data" }
  }
}
```

| Status | code | When |
|---|---|---|
| 400 | `INVALID_HANDLE` | Handle format invalid (wrong domain, bad chars, too short, etc.) |
| 404 | `USER_NOT_FOUND` | No user with this handle |
| 404 | `TIPPING_DISABLED` | User exists but has disabled tipping |
| 429 | `RATE_LIMITED` | Too many requests from this IP within the window |
| 500 | `INTERNAL_ERROR` | Unexpected server error (logged with full detail; client gets generic message) |

## Headers (all endpoints)

Every response includes:

| Header | Purpose |
|---|---|
| `X-Request-Id` | Correlation ID; echoed back from request if provided |
| `X-RateLimit-Limit` | Requests allowed per window |
| `X-RateLimit-Remaining` | Remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |
| `Vary: Origin` | CORS-related |

CORS exposes these headers to browsers via `Access-Control-Expose-Headers`.

## Phase 2 (not yet implemented)

| Method | Path | Auth |
|---|---|---|
| POST | /atproto/createAccount | Firebase ID token |
| POST | /atproto/getSession | Wallet signature |
| POST | /atproto/deleteAccount | Wallet signature |
