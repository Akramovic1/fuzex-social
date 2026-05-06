# Integrating fuzex-api with the Flutter mobile app

This guide describes the signup + session flow the mobile app implements
against fuzex-api's Phase 2 endpoints.

> **Domain migration (2026-05):** fuzex-api now lives at `dev-api.fuzex.social`.
> Old hostnames on `dev-api.fuzex.app` have been deprecated. The mobile team
> must update their HTTP base URL to the new hostname. Production will be
> `api.fuzex.social` (no env prefix). See
> [ADR 0007](./decisions/0007-migrate-to-fuzex-social-domain.md).

## Audience

Flutter engineers integrating against `https://dev-api.fuzex.social` (dev) or
the future production API.

## Prerequisites

- Firebase Auth is already configured in the mobile app.
- The embedded wallet system creates a wallet client-side and exposes the
  public address to the app.
- The mobile app has Firestore SDK access to its own user documents.

## Signup flow

The signup is a 4-step orchestration. Steps 1-3 happen in the mobile app;
step 4 calls fuzex-api.

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Firebase Auth                                              │
│    The user signs up via email/password, phone (SMS),        │
│    Google, or Apple. The Firebase SDK returns a User object.  │
└──────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Wallet creation                                            │
│    The embedded wallet system generates the user's wallet     │
│    and returns the public address.                            │
└──────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Firestore profile write                                    │
│    Mobile writes Users/{firebase_uid} with:                   │
│      walletAddress, username, name, dateOfBirth, gender       │
└──────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. POST /v1/atproto/createAccount                             │
│    Bearer = Firebase ID token. No body.                       │
│    fuzex-api reads Firestore + creates PDS account.           │
└──────────────────────────────────────────────────────────────┘
```

## Step 3: Firestore document shape

Write to `Users/{firebase_uid}`:

```json
{
  "walletAddress": "0xabcdef0123456789abcdef0123456789abcdef01",
  "username": "akram",
  "name": "Akram",
  "dateOfBirth": "1990-01-15",
  "gender": "male"
}
```

| Field | Type | Validation |
|---|---|---|
| `walletAddress` | string | `0x` + 40 hex chars |
| `username` | string | 3-20 chars, lowercase + digits + hyphen, NOT in reserved list |
| `name` | string | 1-64 chars. Mapped automatically to atproto's `displayName` profile field and to the Postgres `display_name` column. |
| `dateOfBirth` | string | ISO 8601 date `YYYY-MM-DD` |
| `gender` | string | one of `female`, `male`, `prefer_not_to_say` |

If any field is missing or invalid, fuzex-api returns `400 BAD_REQUEST`
with a descriptive `error.message`.

**Recommended:** before calling createAccount, the app should confirm
`username` availability via [`GET /v1/username/check`](./api-reference.md#get-v1usernamecheck).

## Step 4: Call createAccount

```dart
final idToken = await firebaseUser.getIdToken();
final response = await http.post(
  Uri.parse('https://dev-api.fuzex.social/v1/atproto/createAccount'),
  headers: {
    'Authorization': 'Bearer $idToken',
    'Content-Type': 'application/json',
  },
  // No request body — fuzex-api reads everything from Firestore + the token
);

if (response.statusCode == 201) {
  final body = jsonDecode(response.body);
  final did = body['did'] as String;
  final handle = body['handle'] as String;
  // Cache the DID + handle locally for the user's atproto identity
} else {
  // Error handling — see "Error responses" below
}
```

The endpoint is **idempotent**: if the user already has a Postgres row,
fuzex-api returns the existing identity unchanged with status 201. The app
can safely call this on every fresh login if it's not sure whether the
user has been created.

## Session minting

After signup (or on any session expiry), the app obtains a fresh PDS
access JWT via:

```dart
final idToken = await firebaseUser.getIdToken();
final response = await http.post(
  Uri.parse('https://dev-api.fuzex.social/v1/atproto/getSession'),
  headers: {'Authorization': 'Bearer $idToken'},
);

if (response.statusCode == 200) {
  final body = jsonDecode(response.body);
  final accessJwt = body['accessJwt'] as String;
  final refreshJwt = body['refreshJwt'] as String;
  // Use these JWTs against the PDS directly for posting, reading feeds, etc.
}
```

After the initial getSession, the app should refresh the PDS access token
via the standard atproto `com.atproto.server.refreshSession` flow (against
the PDS, not fuzex-api). Only call getSession when the refresh token has
also expired or been invalidated.

## Username availability check

```dart
final response = await http.get(
  Uri.parse('https://dev-api.fuzex.social/v1/username/check?username=$candidate'),
);
final body = jsonDecode(response.body);
final available = body['available'] as bool;
final reason = body['reason'] as String?;
```

Reasons (when `available == false`):

| Reason | Meaning |
|---|---|
| `TOO_SHORT` | < 3 chars |
| `TOO_LONG` | > 30 chars |
| `INVALID_CHARSET` | Contains chars outside `[a-z0-9-]` |
| `STARTS_OR_ENDS_WITH_HYPHEN` | Leading/trailing `-` |
| `CONSECUTIVE_HYPHENS` | Contains `--` |
| `ONLY_DIGITS` | All-digit username |
| `RESERVED` | On the reserved-words list (`admin`, `support`, etc.) |
| `ALREADY_TAKEN` | Another user has this username |

## Error responses

All endpoints share the error envelope:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "firestore user doc invalid: walletAddress: ...",
    "details": { "firebaseUid": "..." }
  }
}
```

Codes the mobile client should handle explicitly:

| Status | Code | What to do |
|---|---|---|
| 401 | `UNAUTHORIZED` | Refresh the Firebase ID token and retry once |
| 404 | `NOT_FOUND` | Likely a Firestore-write race; show a generic "try again" UX after 1-2s |
| 400 | `BAD_REQUEST` | Validation failure; surface `error.message` to the user |
| 422 | `UNPROCESSABLE_ENTITY` | Age gating; show "you must be 13+" copy |
| 409 | `CONFLICT` | Username taken; reset the form to the username step |
| 429 | `RATE_LIMITED` | Backoff per `Retry-After` header |
| 500 | `INTERNAL_ERROR` | Show generic error; report `X-Request-Id` to support |

## Token refresh strategy

Firebase ID tokens expire in 1 hour. The mobile client should:

1. Call `firebaseUser.getIdToken(forceRefresh: false)` before each request
   — the SDK refreshes automatically if the token is within ~5 minutes of
   expiry.
2. On a 401 from fuzex-api, call `firebaseUser.getIdToken(forceRefresh: true)`
   and retry the original request once.

Do NOT cache the ID token across app launches. Always read it via the
Firebase SDK.

## Local development

For local end-to-end tests against a dev instance of fuzex-api:

1. Run the API: `npm run dev` (port 3001 by default).
2. Use a real Firebase ID token from the mobile app pointed at the dev
   Firebase project (`fuzex-41211`).
3. Replace `https://dev-api.fuzex.social` with `http://localhost:3001`.

Note: localhost API needs a Firebase service account JSON at
`api/firebase-dev-service-account.json` (mode 600). It must belong to the
same Firebase project the token was issued against; otherwise tokens fail
verification.

## Reference

- [`api-reference.md`](./api-reference.md) — full endpoint contract
- [`architecture.md`](./architecture.md) — system design
- [`decisions/0005-firestore-as-source-of-truth-for-profile-data.md`](./decisions/0005-firestore-as-source-of-truth-for-profile-data.md) — why we read from Firestore instead of accepting profile data in the request body
- [`decisions/0004-synthetic-email-for-phone-only-users.md`](./decisions/0004-synthetic-email-for-phone-only-users.md) — phone-only signup behavior
