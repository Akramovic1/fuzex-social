# 0004 — Synthetic email for phone-only users

**Status:** Accepted (2026-05)

## Context

Bluesky PDS requires an email address when creating an account
(`com.atproto.server.createAccount`). FuzeX supports several Firebase Auth
methods including phone-only signups (Saudi Arabia, India, etc.). When a user
signs up by SMS, the Firebase ID token has no `email` claim — only
`phone_number`.

We could:

A. Block phone-only signups until the user adds an email.
B. Prompt the user for an email at signup time.
C. Synthesize a placeholder email that satisfies PDS without surfacing it
   to the user.

## Decision

**Option C: synthesize a placeholder email.**

When the verified Firebase token has no email but has a phone number,
fuzex-api derives an email of the form:

```
phone-{e164-digits-only}@email.fuzex.social
```

For example, a token with `phone_number: "+1 (555) 123-4567"` becomes
`phone-15551234567@email.fuzex.social`. The synthetic email is stored on the
PDS account and ignored by the user (PDS does not send mail to it; emails
go via Firebase Auth's built-in flows).

The fallback for users with neither email nor phone (anonymous signup) is
`uid-{firebase_uid}@email.fuzex.social`. This branch is unused today but kept
for completeness.

## Consequences

### Positive

- Phone-only users can sign up with the same flow as email users — no extra
  friction at registration.
- The synthetic-email pattern is visibly distinguishable, so any future
  "upgrade your account" flow can detect synthetic addresses and prompt for
  a real one (`isSyntheticEmail()` helper exists for this).
- `email.fuzex.social` is already verified in Resend for outbound mail; it's a
  trusted domain we already operate.

### Negative

- The synthetic addresses are non-functional — sending mail to one would
  bounce. If anything in the system tries to email the user via the PDS
  email address (instead of via Firebase Auth), it will fail silently. We
  consciously route ALL transactional email through Firebase Auth, not PDS,
  so this is not a problem in practice.
- A small risk of synthetic-vs-real ambiguity if a real user happens to own
  `phone-15551234567@email.fuzex.social` — but `email.fuzex.social` is our
  domain, so we control whether such a mailbox exists. We deliberately do
  not provision any real mailboxes there.

## Alternatives considered

### Block phone-only signups

Rejected — markets where phone-only is the norm (e.g., MENA) would be
unable to use the product.

### Prompt for email at signup time

Rejected — adds friction; many users would abandon. The PDS-required email
is not user-facing data; there's no reason to ask the user for it.

### Use the user's phone number as the literal email local part

Considered, but the leading `+` in E.164 is invalid in the local part of
an email (RFC 5321). Stripping non-digits and prefixing `phone-` keeps
things parseable.
