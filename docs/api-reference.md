# API Reference

Phase 1 endpoints. All endpoints are under `https://dev-api.fuzex.app` unless noted.

## GET /health

Liveness check with database ping.

**Auth:** None
**Response:** `application/json`

```bash
curl https://dev-api.fuzex.app/health
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
curl https://dev-api.fuzex.app/v1/resolve/akram.dev.fuzex.app
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

## Authentication

Phase 2 endpoints require a Firebase ID token in the `Authorization` header:

```
Authorization: Bearer <firebase-id-token>
```

The token is verified via the firebase-admin SDK using the project's service
account. fuzex-api never sees the user's password; it relies on Firebase Auth
for identity. Tokens are short-lived (1 hour); the mobile client refreshes them
on demand using the Firebase SDK.

Failures return 401 with one of these messages:

| Cause | message |
|---|---|
| Header missing | `missing Authorization header` |
| Wrong scheme | `Authorization header must use Bearer scheme` |
| Empty token | `Bearer token is empty` |
| Verification failed | `invalid or expired token` |

## POST /v1/atproto/createAccount

Creates a Bluesky PDS account for the authenticated Firebase user, writes the
profile record, and inserts the corresponding row in Postgres.

**Auth:** Firebase ID token (Bearer)
**Idempotency:** If the user already has a row, returns the existing identity
without creating a new PDS account.
**Prerequisite:** The mobile app must have written the user's profile to
`Users/{firebase_uid}` in Firestore BEFORE calling this endpoint. fuzex-api
reads `walletAddress`, `username`, `displayName`, `dateOfBirth`, and `gender`
from that document. See [integration-with-mobile.md](./integration-with-mobile.md).

**Request body:** None — all data is sourced from the verified token + Firestore.

**Response 201:**

```json
{
  "did": "did:plc:cwbqnunxsu7isx4vv4zul4un",
  "handle": "akram.dev.fuzex.app",
  "displayName": "Akram"
}
```

**Errors:**

| Status | code | When |
|---|---|---|
| 401 | `UNAUTHORIZED` | Missing / invalid Firebase token |
| 404 | `NOT_FOUND` | Firestore `Users/{uid}` doc missing after retries |
| 400 | `BAD_REQUEST` | Firestore doc fails schema validation |
| 422 | `UNPROCESSABLE_ENTITY` | User is under `MIN_USER_AGE` (default 13) |
| 409 | `CONFLICT` | Requested username is already taken |
| 500 | `INTERNAL_ERROR` | PDS createAccount or insert failed unexpectedly |

## POST /v1/atproto/getSession

Issues a fresh PDS session (access + refresh JWTs) for an existing user.

**Auth:** Firebase ID token (Bearer)
**Request body:** None.

**Response 200:**

```json
{
  "did": "did:plc:cwbqnunxsu7isx4vv4zul4un",
  "handle": "akram.dev.fuzex.app",
  "accessJwt": "<pds-access-jwt>",
  "refreshJwt": "<pds-refresh-jwt>"
}
```

The access JWT is short-lived; clients use the refresh JWT against the PDS
directly via the standard atproto `com.atproto.server.refreshSession` flow.

**Errors:**

| Status | code | When |
|---|---|---|
| 401 | `UNAUTHORIZED` | Missing / invalid Firebase token |
| 404 | `NOT_FOUND` | No atproto account for this Firebase UID — call `createAccount` first |
| 400 | `BAD_REQUEST` | Account predates Phase 2 (no encrypted PDS password stored) |

## GET /v1/username/check

Checks whether a username is available. Used by mobile during signup form
input. No auth required.

**Query parameters:**

| Param | Type | Notes |
|---|---|---|
| `username` | string | The candidate username (any case; lowercased server-side) |

**Response 200:**

```json
{
  "username": "akram",
  "available": false,
  "reason": "ALREADY_TAKEN"
}
```

| Field | Type | Notes |
|---|---|---|
| `username` | string | Echoed back, lowercased |
| `available` | boolean | True iff the username could be claimed right now |
| `reason` | string \| null | `null` when available; otherwise one of: `TOO_SHORT`, `TOO_LONG`, `INVALID_CHARSET`, `STARTS_OR_ENDS_WITH_HYPHEN`, `CONSECUTIVE_HYPHENS`, `ONLY_DIGITS`, `RESERVED`, `ALREADY_TAKEN` |

**Errors:**

| Status | code | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Missing `username` query parameter |

## Phase 3 (not yet implemented)

| Method | Path | Auth |
|---|---|---|
| POST | /v1/atproto/deleteAccount | Wallet signature |
| POST | /v1/profile/update | Firebase ID token |
