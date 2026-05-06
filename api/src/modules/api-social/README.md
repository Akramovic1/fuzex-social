# api-social module

The social/atproto-facing routes of fuzex-api.

## Routes

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/health` | Liveness + DB ping | None |
| GET | `/.well-known/atproto-did` | atproto handle verification | None |
| GET | `/v1/resolve/:handle` | Public tipping resolver | None |

## Future routes (Phase 2)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/atproto/createAccount` | Create PDS account | Firebase ID token |
| POST | `/atproto/getSession` | Mint fresh PDS session | Wallet signature |
| POST | `/atproto/deleteAccount` | Delete PDS account | Wallet signature |

## Structure

```
api-social/
├── index.ts            — module factory (composes route factories + builds services)
├── routes/             — HTTP layer (thin)
├── services/           — domain logic (UserResolver)
├── lib/                — pure helpers (handleValidation, reservedUsernames)
└── schemas/            — zod response schemas
```

## Dependency injection

The module factory takes a `deps` object with everything the routes need
(database, handle domain). Inside, it builds the repository and service layer,
then composes the routes.

```ts
const module = buildApiSocialModule({
  db: testDb,
  handleDomain: '.dev.fuzex.social',
});
```

## Conventions

- Routes throw `HandleResolutionError` (or other `AppError` subclasses) — never
  return raw JSON error bodies. The global error handler formats them.
- The well-known endpoint returns `text/plain` with NO trailing newline.
  atproto verifiers are strict.
- The well-known endpoint returns 404 with EMPTY body for ALL resolution
  failures (don't leak which usernames exist).
- The resolve endpoint returns the standard `{ error: { code, message } }`
  shape on failure.
