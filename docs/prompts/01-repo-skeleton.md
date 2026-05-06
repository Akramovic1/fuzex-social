# Prompt 1 of 6 — Repo Skeleton + Tooling

## Mission

You are scaffolding the **`fuzex-social`** monorepo (Akramovic1/fuzex-social on GitHub). The repo currently contains only `README.md` and `.gitignore` from GitHub's initial setup.

This prompt sets up the **foundation only**: directory layout, package.json, tooling configs (TypeScript, ESLint, Prettier, Husky, Jest), root files. NO source code yet, NO endpoints yet — those come in later prompts.

**Critical rules:**
- NEVER use placeholder comments like `// TODO`, `// rest of code`, `// add logic here`
- Every file must be complete and syntactically valid
- Every file you create must exist with proper content — no empty files except `.gitkeep` markers
- Follow industrial standards (this codebase will be production)

---

## Project Context (read carefully)

**FuzeX** is a decentralized social media + activity booking + crypto wallet platform.

This repo (`fuzex-social`) houses the social/atproto layer:
- A new Hono backend that will run on the VPS at `api.dev.fuzex.app`
- Database schema for social-layer data (Postgres on VPS)
- Infrastructure files (Caddy config, deploy scripts)
- Documentation

**Existing infrastructure (deployed and working — do not touch):**
- Hetzner VPS in Nuremberg (Ubuntu 24.04)
- Caddy 2.x with auto-HTTPS
- Bluesky PDS (atproto) federating successfully
- Test account `akram.dev.fuzex.app` (DID: `did:plc:cwbqnunxsu7isx4vv4zul4un`) posting to Bluesky
- Cloudflare DNS with wildcard `*.dev.fuzex.app` → VPS

**Locked-in tech decisions (do not deviate):**
- TypeScript strict mode (no JS files anywhere)
- Hono framework on Node.js 20 LTS
- Drizzle ORM with `pg` driver (NOT Prisma, NOT TypeORM)
- pm2 for production process management
- Local Postgres dev runs in Docker on **port 5433** (not 5432)
- ESLint + Prettier + Husky + lint-staged + commitlint
- Jest + ts-jest for testing
- pino for logging
- zod for validation

---

## Required Directory Layout (create exactly this)

> **Husky v9 note:** `.husky/` lives at the **repo root**, not under `api/`. The hooks themselves `cd api && ...` so they operate on the api package even though they sit at the root. The `prepare` script in `api/package.json` runs husky from the repo root via `cd .. && husky`.

```
fuzex-social/                      # repo root (already exists)
├── .editorconfig                  # NEW
├── .gitignore                     # UPDATE existing
├── .nvmrc                         # NEW — contains "20"
├── CHANGELOG.md                   # NEW
├── LICENSE                        # NEW (UNLICENSED)
├── NewKnowledgeBase.md            # NEW
├── README.md                      # REPLACE existing
│
├── .husky/                        # NEW — hooks live at repo root (Husky v9 idiom)
│   ├── pre-commit
│   └── commit-msg
│
├── api/                           # NEW — the Hono backend lives here
│   ├── .env.example               # NEW (committed template)
│   ├── .env.dev.example           # NEW (committed template)
│   ├── .eslintignore              # NEW
│   ├── .eslintrc.cjs              # NEW
│   ├── .gitignore                 # NEW (api-specific ignores)
│   ├── .prettierignore            # NEW
│   ├── .prettierrc.json           # NEW
│   ├── README.md                  # NEW
│   ├── commitlint.config.cjs      # NEW
│   ├── drizzle.config.ts          # NEW (skeleton — schema doesn't exist yet)
│   ├── ecosystem.config.cjs       # NEW (pm2 — file lives here, dist/ doesn't exist yet)
│   ├── jest.config.cjs            # NEW
│   ├── package.json               # NEW
│   ├── tsconfig.json              # NEW
│   ├── tsconfig.build.json        # NEW
│   │
│   └── src/                       # NEW — empty for now, just the dir
│       └── .gitkeep
│
├── infrastructure/                # NEW
│   ├── README.md                  # NEW
│   └── .gitkeep                   # NEW (so the empty dir commits)
│
├── scripts/                       # NEW
│   ├── README.md                  # NEW
│   └── .gitkeep                   # NEW
│
└── docs/                          # NEW
    ├── README.md                  # NEW
    └── prompts/
        ├── 01-repo-skeleton.md    # NEW (this file)
        └── .gitkeep               # NEW
```

---

## File Contents

### Root `.gitignore` (UPDATE existing)

Replace existing content with:

```
# Dependencies
node_modules/
.pnp
.pnp.js

# Build output
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local
!.env.example
!.env.dev.example

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Testing
coverage/
.nyc_output/

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# OS
Thumbs.db

# Husky
.husky/_/

# Drizzle (generated)
drizzle/
```

### Root `.editorconfig`

```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_size = 2
indent_style = space
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

### Root `.nvmrc`

```
20
```

### Root `LICENSE`

```
UNLICENSED — Proprietary

Copyright (c) 2026 FuzeX. All rights reserved.

This source code is the proprietary and confidential property of FuzeX.
Unauthorized copying, distribution, modification, or use is strictly prohibited.
```

### Root `README.md` (REPLACE existing)

```markdown
# fuzex-social

The social/atproto layer for **FuzeX** — decentralized social media + activity booking + crypto wallet platform.

This monorepo contains the Hono backend, Postgres schema, infrastructure configs, and deployment scripts that connect FuzeX to the atproto network (Bluesky federation).

## Architecture (high level)

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  Hetzner VPS (Nuremberg)                                         │
│                                                                   │
│  Caddy ─┬─→ Bluesky PDS (port 3000) ─── PDS SQLite              │
│         └─→ fuzex-api (port 3001) ─→ Postgres (port 5432)       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

External (cloud):
- Firestore     — existing FuzeX product data (untouched)
- Firebase Auth — user authentication
- Secret Manager — wallet private keys
- Resend        — SMTP for PDS
\`\`\`

## Repository Structure

| Path | Purpose |
|---|---|
| `api/` | Hono backend (TypeScript) |
| `infrastructure/` | Caddy configs, Postgres init scripts |
| `scripts/` | VPS setup + deployment scripts |
| `docs/` | Architecture, deployment, operations, ADRs |

## Quick Start

\`\`\`bash
# Install Node 20
nvm use

# Install API deps
cd api
cp .env.dev.example .env
npm install

# Start local Postgres (Docker, port 5433)
docker run -d --name fuzex-postgres-dev \
  -e POSTGRES_DB=fuzex_social_dev \
  -e POSTGRES_USER=fuzex_api_dev \
  -e POSTGRES_PASSWORD=devpassword \
  -p 5433:5432 \
  --restart unless-stopped \
  postgres:16

# Dev server
npm run dev
\`\`\`

## Documentation

- [`docs/architecture.md`](./docs/architecture.md) — system design
- [`docs/deployment.md`](./docs/deployment.md) — deploy guide
- [`docs/operations.md`](./docs/operations.md) — day-2 ops
- [`docs/api-reference.md`](./docs/api-reference.md) — endpoint reference

## License

UNLICENSED — Proprietary. See [LICENSE](./LICENSE).
```

### Root `CHANGELOG.md`

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial monorepo scaffold
- TypeScript + Hono + Drizzle tooling configuration
- ESLint, Prettier, Husky, lint-staged, commitlint setup
- Jest test runner configuration
- Editor and Node version configs (.editorconfig, .nvmrc)
```

### Root `NewKnowledgeBase.md`

```markdown
# New Knowledge Base

Things learned about this codebase that future contributors should know.
Add new entries as you discover non-obvious behaviors. If an entry is encountered
multiple times, append `xN` instead of duplicating.

## Conventions

- Local Postgres dev runs in Docker on host port **5433** (not 5432) to avoid conflicts with other Postgres instances on the dev machine
- pm2 config files use `.cjs` extension because pm2 requires CommonJS
- All paths use `@/` alias mapped to `api/src/`

## Tooling

- TypeScript strict mode is non-negotiable; do not loosen `tsconfig.json`
- ESLint runs in `--ext .ts` mode; JS files are not allowed in `src/`
- Husky hooks live at the repo root (`.husky/`), not under `api/`. Husky v9 idiom: `prepare` runs `husky` (no path arg) from repo root
```

---

### `api/package.json`

Use exact dependency versions for stability. Mark engines requirement.

```json
{
  "name": "@fuzex/api",
  "version": "0.1.0",
  "private": true,
  "description": "FuzeX social/atproto API — Hono backend",
  "type": "module",
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "format": "prettier --write \"src/**/*.{ts,json}\"",
    "format:check": "prettier --check \"src/**/*.{ts,json}\"",
    "test": "jest --passWithNoTests",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage --passWithNoTests",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/shared/db/migrate.ts",
    "db:studio": "drizzle-kit studio",
    "prepare": "cd .. && husky"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.7",
    "dotenv": "^16.4.5",
    "drizzle-orm": "^0.36.4",
    "hono": "^4.6.14",
    "pg": "^8.13.1",
    "pino": "^9.5.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.6.0",
    "@commitlint/config-conventional": "^19.6.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^20.17.10",
    "@types/pg": "^8.11.10",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^8.18.0",
    "@typescript-eslint/parser": "^8.18.0",
    "drizzle-kit": "^0.30.1",
    "eslint": "^8.57.1",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-import": "^2.31.0",
    "eslint-plugin-unicorn": "^56.0.1",
    "husky": "^9.1.7",
    "jest": "^29.7.0",
    "lint-staged": "^15.2.11",
    "pino-pretty": "^13.0.0",
    "prettier": "^3.4.2",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  },
  "lint-staged": {
    "*.ts": [
      "prettier --write",
      "eslint --fix"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

NOTE: ESLint stays on v8 because v9's flat config has worse plugin compatibility right now. Pin to `^8.57.1`.

NOTE: The `prepare` script `cd .. && husky` runs Husky v9 from the repo root (where `.husky/` lives). The legacy form `husky install <path>` is deprecated in v9 and will fail in v10.

### `api/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": false,
    "sourceMap": true,
    "removeComments": false,
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"]
    },
    "types": ["node", "jest"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "coverage"]
}
```

### `api/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "removeComments": true,
    "sourceMap": false
  },
  "exclude": [
    "node_modules",
    "dist",
    "coverage",
    "**/*.test.ts",
    "**/__tests__/**",
    "src/shared/db/migrate.ts"
  ]
}
```

NOTE: `migrate.ts` is excluded from build because it runs via `tsx` directly in production (we don't compile it).

### `api/.eslintrc.cjs`

```js
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  plugins: ['@typescript-eslint', 'import', 'unicorn'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
      },
      node: {
        extensions: ['.ts'],
      },
    },
  },
  rules: {
    'no-console': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports' },
    ],
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-default-export': 'error',
    'unicorn/filename-case': [
      'error',
      { cases: { camelCase: true, pascalCase: true } },
    ],
    'unicorn/no-null': 'off',
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/prefer-module': 'off',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/__tests__/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['*.config.cjs', '*.config.js', '.eslintrc.cjs', 'commitlint.config.cjs'],
      env: { node: true },
      parserOptions: { project: null },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
  ignorePatterns: ['dist/', 'coverage/', 'node_modules/', '*.config.cjs', '*.config.js'],
};
```

### `api/.eslintignore`

```
dist
coverage
node_modules
*.config.cjs
*.config.js
.husky
```

### `api/.prettierrc.json`

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "quoteProps": "consistent",
  "trailingComma": "all",
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### `api/.prettierignore`

```
dist
coverage
node_modules
*.md
.husky
```

### `api/jest.config.cjs`

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        useESM: false,
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/shared/db/migrate.ts',
    '!src/shared/db/migrations/**',
  ],
  coverageThreshold: {
    global: {
      lines: 70,
      branches: 70,
      functions: 70,
      statements: 70,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'lcov'],
  clearMocks: true,
  verbose: true,
};
```

### `api/drizzle.config.ts`

NOTE: schema file does not exist yet — Prompt 3 creates it. This config is the skeleton; Prompt 3 will reference it. Drizzle-kit requires a default export, so the file disables `import/no-default-export` inline.

```ts
/* eslint-disable import/no-default-export */
import 'dotenv/config';
import type { Config } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required for drizzle-kit operations');
}

const config: Config = {
  schema: './src/shared/db/schema.ts',
  out: './src/shared/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
};

export default config;
```

### `api/ecosystem.config.cjs`

```js
/** @type {import('pm2').StartOptions[]} */
module.exports = {
  apps: [
    {
      name: 'fuzex-api',
      script: './dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      time: true,
      merge_logs: true,
      kill_timeout: 5000,
      listen_timeout: 8000,
    },
  ],
};
```

### `api/commitlint.config.cjs`

```js
/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'chore', 'docs', 'refactor', 'test', 'build', 'ci', 'perf', 'style', 'revert'],
    ],
    'subject-case': [0],
  },
};
```

### Repo-root `.husky/pre-commit`

Lives at repo root, not under `api/`. The hook itself `cd`s into `api/` before running lint-staged.

Husky v9 hook body is just the shebang + the command — no `_/husky.sh` sourcing line. The v8 idiom (`. "$(dirname -- "$0")/_/husky.sh"`) is deprecated in v9 and will fail in v10.

```sh
#!/usr/bin/env sh
cd api && npx lint-staged
```

Make this file executable (chmod 755). Verify unix line endings (LF, not CRLF).

### Repo-root `.husky/commit-msg`

```sh
#!/usr/bin/env sh
cd api && npx --no-install commitlint --edit "$1"
```

Make executable (chmod 755), unix line endings.

### `api/.gitignore`

```
node_modules/
dist/
coverage/
.env
.env.local
.env.*.local
!.env.example
!.env.dev.example
logs/
*.log
*.tsbuildinfo
.husky/_/
```

### `api/.env.example`

```
# Server
NODE_ENV=development
PORT=3001
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://fuzex_api_dev:devpassword@localhost:5433/fuzex_social_dev

# atproto / handle config
HANDLE_DOMAIN=.dev.fuzex.app
PDS_URL=https://pds.dev.fuzex.app

# CORS
CORS_ALLOWED_ORIGINS=https://app.fuzex.app,https://dev.fuzex.app,http://localhost:3000

# Rate limit
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### `api/.env.dev.example`

```
# Local development environment
# Copy to .env and adjust as needed

NODE_ENV=development
PORT=3001
LOG_LEVEL=debug

# Local Postgres in Docker (port 5433 to avoid conflict)
DATABASE_URL=postgresql://fuzex_api_dev:devpassword@localhost:5433/fuzex_social_dev

# Dev handle domain
HANDLE_DOMAIN=.dev.fuzex.app
PDS_URL=https://pds.dev.fuzex.app

CORS_ALLOWED_ORIGINS=http://localhost:3000

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
```

### `api/README.md`

```markdown
# fuzex-api

Hono backend serving the social/atproto layer of FuzeX.

## Stack

- Node.js 20 LTS
- TypeScript strict mode
- Hono framework
- Drizzle ORM (Postgres)
- Pino logger
- Zod validation
- Jest + ts-jest
- ESLint + Prettier + Husky

## Setup

\`\`\`bash
cp .env.dev.example .env
npm install
npm run db:migrate
npm run dev
\`\`\`

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Watch mode dev server |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server |
| `npm run typecheck` | Type check without emit |
| `npm run lint` | Lint TypeScript files |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Prettier |
| `npm test` | Run Jest tests |
| `npm run test:coverage` | Tests with coverage report |
| `npm run db:generate` | Generate Drizzle migration from schema |
| `npm run db:migrate` | Apply pending migrations |

## Structure

See [`/docs/architecture.md`](../docs/architecture.md) at repo root.
```

---

### `infrastructure/README.md`

```markdown
# Infrastructure

Infrastructure-as-code and config files for the FuzeX social stack.

## Directory layout (will populate over coming prompts)

- `caddy/` — Caddyfile for reverse proxy on the VPS
- `postgres/` — Postgres init SQL (run once on fresh VPS)

## Deployment

See [`/docs/deployment.md`](../docs/deployment.md).
```

### `infrastructure/.gitkeep`

Empty file (just so the directory commits).

### `scripts/README.md`

```markdown
# Scripts

Operational scripts for VPS provisioning and deployment.

## Will be added in later prompts

- `setup-vps.sh` — idempotent VPS setup (Node, pm2, Postgres)
- `deploy.sh` — git pull, build, migrate, pm2 reload
- `seed-akram.sql` — manual seed for Phase 1 testing
```

### `scripts/.gitkeep`

Empty file.

### `docs/README.md`

```markdown
# Documentation

| File | Purpose |
|---|---|
| `architecture.md` | System design overview |
| `deployment.md` | Deployment guide |
| `operations.md` | Day-2 operations |
| `api-reference.md` | Endpoint reference |
| `decisions/` | Architecture Decision Records (ADRs) |
| `prompts/` | Build prompts (used to generate this codebase) |
```

### `docs/prompts/.gitkeep`

Empty file.

### `api/src/.gitkeep`

Empty file (src/ is empty until Prompt 2 fills it).

---

## Verification Checklist

After generating all files, verify each is true:

- [ ] All directories from the layout exist
- [ ] All files listed have proper, complete content (no `// TODO`, no empty files except `.gitkeep`)
- [ ] `.husky/pre-commit` and `.husky/commit-msg` (at repo root) are executable (chmod 755)
- [ ] All `.cjs` files use `module.exports = ...` (CommonJS)
- [ ] All `.ts` files use ESM imports/exports (since `package.json` has `"type": "module"`)
- [ ] `api/package.json` has all listed deps with the exact versions specified
- [ ] `api/package.json` `prepare` script is `cd .. && husky` (Husky v9 idiom; not the deprecated `husky install <path>`)
- [ ] `api/tsconfig.json` has `"strict": true` and all the strict flags
- [ ] `.eslintrc.cjs` extends the type-checked config and includes `prettier` last in extends
- [ ] `jest.config.cjs` has 70% coverage thresholds and `passWithNoTests` will work since we have no tests yet
- [ ] After `npm install` from `api/`, `git config --get core.hooksPath` returns `.husky/_` and `.husky/_/` exists at repo root

### Expected post-install verification results

`npm install` is expected to succeed with deprecation warnings (rimraf/glob/eslint-v8 — upstream, not actionable).

**`npm run typecheck` is expected to FAIL until Prompt 2 adds source files.** Error: `TS18003: No inputs were found in config file '...tsconfig.json'`. This is intrinsic to `tsc` — it errors when the `include` pattern matches zero files. Adding a stub would violate Prompt 1's "no source code" rule, so the failure is accepted at this stage. Prompt 2 creates `src/index.ts` and `src/app.ts` which resolves it.

**`npm run lint` is expected to FAIL with the same root cause.** ESLint's `@typescript-eslint/parser` reuses the broken tsconfig and reports `Parsing error: Unable to parse the specified 'tsconfig' file`. Resolves with Prompt 2.

**Do not commit at the end of Prompt 1.** Wait until Prompt 2 produces real source code, at which point typecheck/lint pass and the hooks can validate the commit.

---

## After Generation

Print a clear summary in this exact format:

```
==================================================
PROMPT 1/6 COMPLETE — Repo Skeleton + Tooling
==================================================

Files created: <count>
Directories created: <count>

Next steps for the user (run from repo root):

1. cd api && npm install
   (downloads ~250MB of node_modules; takes 30-60s)
   The husky `prepare` script runs automatically and wires up
   .husky/_/ at repo root.

2. Verify hooks are wired:
     git config --get core.hooksPath   # should print .husky/_
     ls .husky/_/                       # should list husky.sh + forwarders

3. npm run typecheck
   Expected to FAIL with TS18003 (no .ts files in src/ yet).
   This resolves naturally when Prompt 2 adds source files.

4. npm run lint
   Expected to FAIL with the same TS18003 root cause.
   Also resolves with Prompt 2.

5. Do NOT commit yet. The hooks won't have anything to validate.
   Wait for Prompt 2 to add real source code, then commit.

When ready, request Prompt 2 of 6 (Shared Infrastructure).
==================================================
```

DO NOT create any source code files (no `index.ts`, no `app.ts`, no schema, no routes). Those come in Prompts 2-5. DO NOT skip any file from the structure. DO NOT create files outside the structure listed.
