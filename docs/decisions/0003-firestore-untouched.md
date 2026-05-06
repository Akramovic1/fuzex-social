# 0003 — Existing Firestore data remains in Firestore

**Status:** Accepted (2026-01)

## Context

FuzeX has been running on Firestore + Firebase Auth + Cloud Functions for
existing product features (profiles, bookings, events, wallet metadata).
This new social/atproto layer introduces a Postgres on the VPS.

Question: do we migrate existing data to Postgres for consistency, or keep
the split?

## Decision

**Keep the split. Existing Firestore data stays in Firestore. Postgres on the
VPS holds ONLY new social-layer data.**

## Consequences

### Positive

- Zero migration risk on production data
- Real-time sync features (Firestore listeners) continue to work for chat,
  notifications, presence, and any other reactive UI
- Mobile offline-first behavior preserved (Firestore SDK handles this natively)
- Each system used for what it's good at:
  - Firestore: real-time, mobile-first, document data
  - Postgres: SQL, transactions, atproto integrity
- Firebase Auth integration unchanged

### Negative

- Two source-of-truth systems for "user" — `firebase_uid` is the bridge
- Joining data across Firestore and Postgres requires application-level logic
- Slightly more cognitive overhead reading the codebase

### How we manage the split

The bridge is `firebase_uid`. Every user record in Postgres includes the
`firebase_uid` of the corresponding Firebase Auth user. Application logic
that needs both Firestore profile data AND Postgres atproto data:

1. Resolve user from Firebase Auth → `firebase_uid`
2. Query Firestore for profile/preferences with `firebase_uid`
3. Query Postgres for atproto/wallet data with `firebase_uid`
4. Compose the response

## Alternatives considered

### Migrate Firestore data to Postgres

Rejected. The migration risk is real (production data, custom rules, indexed
queries). The benefits would be marginal (one fewer system) at the cost of
losing Firestore's strengths.

### Use Firestore for atproto data too

Rejected. See 0001 — Postgres on VPS gives us localhost queries and SQL
flexibility for the resolver hot path.
