# ADR 0007: Migrate to fuzex.social domain

## Status

Accepted (2026-05-06)

## Context

fuzex-api was originally deployed under `fuzex.app` subdomains (e.g.,
`dev-api.fuzex.app`, `pds.dev.fuzex.app`, `*.dev.fuzex.app`). This caused
two issues:

1. atproto handles (`username.dev.fuzex.app`) were ambiguous — they read as
   "app subdomain" rather than "social handle".
2. The same domain housed both the main app (booking, payments, marketing)
   and the social layer (PDS, atproto), making domain-level boundaries
   between these two distinct concerns invisible.

The team purchased `fuzex.social` to dedicate to the social/atproto stack.

## Decision

Migrate all social/atproto hostnames to `fuzex.social`:

- Production: `api.fuzex.social`, `pds.fuzex.social`, `*.fuzex.social`
- Dev: `dev-api.fuzex.social`, `pds.dev.fuzex.social`, `*.dev.fuzex.social`
- Synthetic emails for phone-only signups: `email.fuzex.social`

`fuzex.app` is now reserved exclusively for:

- Marketing site (root)
- Main web app (`app.fuzex.app`)
- Booking/payments/profile API (`api.fuzex.app`)
- Email reputation for the main app (`email.fuzex.app`)

Both domains evolve independently from now on.

## Consequences

### Positive

- Cleaner brand: `username.fuzex.social` immediately reads as a social handle.
- Federation hygiene: relays only see `fuzex.social` for atproto interactions;
  unrelated to whatever happens on `fuzex.app`.
- Independent scaling and operations: outages or DNS changes on one domain
  don't affect the other.
- Cleaner CORS configuration: explicit per-domain origin rules.
- Frees `api.fuzex.app` for the existing FuzeX product backend (booking,
  payments, etc.) — previously colliding with the planned production
  fuzex-api hostname.

### Negative

- Existing test handles (akram) need recreation with new hostname.
- Bluesky's relay cache needs to refresh after the migration (up to ~1 hour).
- Two domains to maintain (DNS, certs, monitoring) instead of one.
- Documentation needs sweeping updates (handled in this migration).

### Neutral

- Marketing/SEO: both domains can coexist. Recommendation: redirect bare
  `fuzex.social` to `fuzex.app` so the marketing site is canonical.

## Migration timing

Executed pre-launch with only one test user (akram). akram's account is
deleted and re-created with the new handle. No federated user data is lost.

In production, this kind of domain migration would be a major project
requiring user notification, gradual rollout, and PLC handle updates for
every existing account. Pre-launch is the right time.

## Implementation

See [`migration-fuzex-app-to-social.md`](../migration-fuzex-app-to-social.md)
for the step-by-step migration playbook.
