# 0005 — Firestore is the source of truth for profile data

**Status:** Accepted (2026-05)

## Context

At signup, fuzex-api needs to know:

- The user's wallet address (created client-side by the embedded wallet system)
- The username they want to claim
- Their display name
- Their date of birth (for age gating)
- Their gender (for app-level features)

We could pass this data:

A. As a JSON body on `POST /v1/atproto/createAccount`.
B. By having the mobile app write it to Firestore first, then fuzex-api
   reads from Firestore at signup time.

## Decision

**Option B: mobile writes Firestore first; fuzex-api reads from Firestore.**

The mobile app:
1. Authenticates the user via Firebase Auth
2. Has the embedded wallet system create a wallet
3. Writes `Users/{firebase_uid}` in Firestore with the profile data
4. Calls `POST /v1/atproto/createAccount` (just the Bearer token; no body)

fuzex-api:
1. Verifies the Firebase token
2. Reads `Users/{firebase_uid}` from Firestore (with retry — see below)
3. Validates the document with a strict zod schema
4. Proceeds to PDS createAccount + Postgres insert

## Consequences

### Positive

- **Single source of truth.** The mobile app already writes user profile
  data to Firestore for its own use (real-time UI, offline, etc.). Adding a
  request body to fuzex-api would mean the same fields exist in two places
  and could drift.
- **No client-side trust boundary.** If we accepted the data in the request
  body, the mobile app could in principle send a different `walletAddress`
  than what was actually created. By reading from Firestore (which already
  has its own security rules controlling which UID can write where), we
  inherit those rules.
- **Retry logic.** The mobile app might call createAccount before its
  Firestore write fully propagates. fuzex-api retries the Firestore read
  3 times with backoff (300/600/900 ms), turning the race into a tolerated
  ~2-second window.

### Negative

- **Adds a Firestore dependency to fuzex-api.** The VPS now has to reach
  Google's Firestore endpoints. We need a Firebase service account JSON file
  on the VPS (in addition to the Postgres password and PDS admin password).
- **Latency.** A Firestore round-trip adds ~150-300ms to signup. That's
  acceptable for a once-per-user operation (signup), would not be for a hot
  path (resolveHandle stays in Postgres only).

### Race-condition mitigation

The retry loop (300ms / 600ms / 900ms backoff, then NotFoundError) covers
the typical "mobile wrote Firestore, then immediately called fuzex-api"
race. In production we expect <1% of signups to hit a single retry; we have
not seen any hit two retries.

## Alternatives considered

### Accept profile data in the request body

Rejected because:
- Two sources of truth (Firestore + request body) drift over time.
- The mobile app needs to write Firestore anyway for its own UI.
- We'd have to re-validate and trust client-supplied fields like
  `walletAddress`. Sourcing from Firestore is no less trustworthy and it's
  one less duplicate field to maintain.

### Skip Firestore; have the wallet system tell us the wallet address directly

Rejected — the wallet system writes Firestore; it has no API for fuzex-api
to read from. Adding one would be more work than the Firestore SDK call.
