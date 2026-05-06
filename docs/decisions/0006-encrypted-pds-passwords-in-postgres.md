# 0006 — Encrypted PDS passwords in Postgres (Phase 2)

**Status:** Accepted (2026-05) — Phase 2 only; revisit in Phase 3

## Context

Each user has a per-account PDS password. The user never sees or types it —
fuzex-api generates a random base64url string at account-creation time and
later uses it to mint sessions on behalf of the user (via
`POST /v1/atproto/getSession`).

We need to store this password somewhere that fuzex-api can read, but in
a way that compromise of the Postgres database alone does not expose the
passwords.

Three options:

A. Store the plaintext password in Postgres.
B. Encrypt the password at rest using a key derived from a separate
   environment variable. Store ciphertext in Postgres; key in `.env`.
C. Store password references (key names) in Postgres; keep actual passwords
   in a dedicated Secret Manager (GCP Secret Manager / AWS Secrets Manager
   / Vault).

## Decision

**Option B for Phase 2. Move to Option C in Phase 3.**

Phase 2 implementation:

- The `users` table has a `pds_password_encrypted TEXT` column.
- On account creation, fuzex-api generates a random password, encrypts it
  with AES-256-GCM using a key derived from `PDS_PASSWORD_ENCRYPTION_KEY`
  (via scrypt with a fixed domain-separator salt), and stores the
  base64-encoded `iv || tag || ciphertext` bundle.
- On `getSession`, fuzex-api reads the bundle, decrypts, and uses the
  password against PDS's `createSession`.
- The encryption key is loaded from `.env` (mode 600 on the VPS).

## Consequences

### Positive (Phase 2)

- A read-only Postgres compromise (e.g., a SQL-injection bug or a stolen DB
  backup) does NOT expose passwords. The attacker would also need
  `PDS_PASSWORD_ENCRYPTION_KEY` from the application's environment.
- AES-256-GCM is authenticated; tampered ciphertexts fail the auth tag and
  decrypt() throws. We surface this as a generic error so we don't leak
  whether tampering occurred.
- Random per-record IVs ensure two encrypted copies of the same plaintext
  differ. Verified via the `produces different ciphertexts on each call`
  test.

### Negative (Phase 2)

- **Encryption key lives on the same VPS as the database.** A full-host
  compromise (root on the VPS) gives the attacker both the DB and the key.
  Phase 3 separates these.
- **Key rotation is manual.** Rotating `PDS_PASSWORD_ENCRYPTION_KEY`
  invalidates all stored ciphertexts; we'd have to decrypt all rows with
  the old key and re-encrypt with the new. Not implemented in Phase 2; if
  we suspect compromise we can rotate user-by-user using `getSession`-then-
  resetPassword flows.
- **Domain separator is hardcoded.** `KEY_SALT = 'fuzex-api-pds-password-v1'`.
  Bumping the suffix invalidates ciphertexts; reserved for future
  cryptographic-construction migrations.

### Phase 3 plan (Option C)

When the application moves to a managed cloud (k8s, ECS, etc.) or when
compliance requirements force separation of secrets:

1. Provision a Secret Manager (GCP Secret Manager preferred — already in
   the FuzeX stack).
2. Replace `pds_password_encrypted` with `pds_password_secret_name` (or
   keep the column and write a forwarder).
3. Migrate existing rows by reading + decrypting from Postgres, writing the
   plaintext to Secret Manager, then nulling the Postgres column.
4. Drop `PDS_PASSWORD_ENCRYPTION_KEY` from the env.

The repository pattern lets us swap this transparently — `usersRepo`
returns a User object, and the encrypt/decrypt boundary is a single
function in `@/shared/utils/encryption.ts`. Replace those with Secret
Manager calls.

## Alternatives considered

### Store plaintext

Rejected — first principle of credential storage. A leaked DB dump (most
likely failure mode) immediately compromises every user's PDS account.

### Use Secret Manager from day one (Phase 2)

Considered, rejected for now. Adding GCP Secret Manager to the Phase 2
deploy would mean:

- Service account with `secretmanager.versions.access` on the VPS.
- Network reachability + retry logic for the Secret Manager API.
- Per-request latency on `getSession` (typically 50-150ms per Secret
  Manager call).

The encryption-at-rest approach lets us ship Phase 2 without that
complexity and revisit when we have a real need (multi-instance scale-out,
compliance audit, etc.).
