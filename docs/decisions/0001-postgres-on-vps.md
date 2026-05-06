# 0001 — Use VPS-local PostgreSQL for social-layer data

**Status:** Accepted (2026-01)

## Context

The new social/atproto layer needs persistent storage for:
- `firebase_uid ↔ username ↔ handle ↔ did ↔ wallet_address` mappings
- Audit logs of social-layer actions
- Invite codes for closed registration

We have an existing Firestore database holding all current FuzeX product
data (user profiles, bookings, events, wallet metadata). We could:

A. Add the new tables to Firestore.
B. Run a separate Postgres on the VPS for ONLY the new data.
C. Migrate everything to Postgres on the VPS.

## Decision

**Option B: separate Postgres on the VPS for new social-layer data only.**

Existing Firestore data stays where it is. Existing FuzeX features continue
to use Firestore unchanged. The new social layer uses Postgres on the VPS.

## Consequences

### Positive

- fuzex-api makes localhost queries to Postgres (~1ms vs ~150ms cross-cloud Firestore)
- The well-known endpoint hits a hot-path query thousands of times per day; localhost beats cross-cloud comfortably
- Schema is small, focused, and SQL-shaped (joins, transactions are easy)
- Flat infrastructure cost — no per-query Firestore billing
- Data ownership: Postgres dump can be backed up off-VPS however we choose

### Negative

- We now operate Postgres (backups, monitoring, patching) — single VPS, single point of failure for THIS data
- If the VPS dies, social-layer data is lost (mitigated: rebuildable from Firestore + PDS, since each user's `firebase_uid` and `did` exist in those systems too)
- Two databases instead of one — slightly more cognitive overhead

### Mitigations

- Daily Postgres backups (manual in Phase 1, automated in Phase 2)
- Off-VPS backup storage in Phase 2
- The `audit_logs` table is the only "lossy" data — it's append-only history; losing recent entries is acceptable

## Alternatives considered

### Firestore for the new layer too

Rejected because:
- Cross-cloud latency hurts the resolver hot path
- Firestore queries don't compose as well as SQL for the joins we anticipate
- Adds Firestore costs that scale linearly with traffic

### Migrate everything to Postgres

Rejected because:
- High migration risk on production data
- Loses real-time sync features Firestore offers (used in chat/notifications)
- Loses mobile offline-first behavior
- Pre-launch is the wrong time to take that risk
