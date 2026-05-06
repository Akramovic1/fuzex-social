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

```bash
cp .env.dev.example .env
npm install
npm run db:migrate
npm run dev
```

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
