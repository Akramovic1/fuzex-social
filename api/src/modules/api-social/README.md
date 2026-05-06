# api-social module

The social/atproto-facing routes of fuzex-api.

## Routes

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/health` | Liveness + DB ping | None |

Future routes (Prompt 5):

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/.well-known/atproto-did` | Resolve handle → DID for atproto verification | None |
| GET | `/v1/resolve/:handle` | Resolve handle → wallet for tipping | None |

## Structure

```
api-social/
├── index.ts            — module factory (composes route factories)
├── routes/
│   ├── health.ts       — GET /health
│   └── index.ts        — barrel
```

## Dependency injection

The module factory takes a `deps` object with everything the routes need
(database, services). This makes the module trivially testable: tests build
their own `deps` with a test DB and inject it.

```ts
const module = buildApiSocialModule({ db: testDb });
```
