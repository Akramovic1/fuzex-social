# Documentation index

## How-tos and playbooks

| File | Purpose |
|---|---|
| [`local-dev-setup.md`](./local-dev-setup.md) | Set up the project locally on your dev machine |
| [`integration-with-mobile.md`](./integration-with-mobile.md) | Mobile (Flutter) integration with the Phase 2 createAccount/getSession flow |
| [`deployment.md`](./deployment.md) | Deploy fuzex-api to the dev VPS |
| [`production-vps-setup.md`](./production-vps-setup.md) | Provision a fresh production VPS |
| [`vps-dev-setup-history.md`](./vps-dev-setup-history.md) | How the dev VPS was originally provisioned (with dead ends) |
| [`migration-fuzex-app-to-social.md`](./migration-fuzex-app-to-social.md) | VPS step-by-step playbook for the `fuzex.app` → `fuzex.social` domain migration |
| [`operations.md`](./operations.md) | Day-2 ops: logs, backups, troubleshooting |

## Reference

| File | Purpose |
|---|---|
| [`architecture.md`](./architecture.md) | System design with diagrams |
| [`api-reference.md`](./api-reference.md) | HTTP endpoint reference |

## Architecture Decision Records

| File | Decision |
|---|---|
| [`decisions/0001-postgres-on-vps.md`](./decisions/0001-postgres-on-vps.md) | Use VPS-local Postgres for social-layer data |
| [`decisions/0002-no-redis-phase-1.md`](./decisions/0002-no-redis-phase-1.md) | No Redis cache in Phase 1 |
| [`decisions/0003-firestore-untouched.md`](./decisions/0003-firestore-untouched.md) | Existing Firestore data stays in Firestore |
| [`decisions/0004-synthetic-email-for-phone-only-users.md`](./decisions/0004-synthetic-email-for-phone-only-users.md) | Synthesize a placeholder email for phone-only signups |
| [`decisions/0005-firestore-as-source-of-truth-for-profile-data.md`](./decisions/0005-firestore-as-source-of-truth-for-profile-data.md) | Read profile data from Firestore at signup |
| [`decisions/0006-encrypted-pds-passwords-in-postgres.md`](./decisions/0006-encrypted-pds-passwords-in-postgres.md) | Encrypt per-user PDS passwords at rest in Postgres (Phase 2) |
| [`decisions/0007-migrate-to-fuzex-social-domain.md`](./decisions/0007-migrate-to-fuzex-social-domain.md) | Move all social/atproto hostnames to fuzex.social |

## Generation prompts

| File | Phase |
|---|---|
| `prompts/01-repo-skeleton.md` | Repo skeleton + tooling |
| `prompts/02-shared-infrastructure.md` | Config, logger, errors, middleware |
| `prompts/03-database-layer.md` | Drizzle schema, migrations, repositories |
| `prompts/04-health-endpoint.md` | /health endpoint + module skeleton |
| `prompts/05-atproto-endpoints.md` | /.well-known/atproto-did + /v1/resolve/:handle |
| `prompts/06-deployment.md` | Caddyfile, scripts, deploy docs |
| `prompts/07-vps-history-and-onboarding.md` | This batch (history + production + local dev docs) |
