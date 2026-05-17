# Development bootstrap

## What exists now

The repo has been scaffolded as a monorepo with:

- `apps/web` — Next.js UI shell
- `apps/api` — NestJS API shell
- `apps/worker` — worker shell
- `packages/shared` — shared types/constants
- `packages/db` — database package + initial SQL schema

## Current choices

- workspace tool: `pnpm`
- task runner: `turbo`
- web: `Next.js`
- api: NestJS app shell
- db: PostgreSQL with plain SQL migration starter

## API status now

The API shell has now been moved to NestJS and includes:

- health endpoint
- metadata endpoint
- first DB-backed `GET /v1/work-items` path

DB access is intentionally plain `pg` for now.
That keeps the first vertical slice simple before deciding whether an ORM is worth the cost.

## Next build slice

1. install dependencies
2. run the web/api shells locally
3. wire real migrations/startup path into local dev
4. add work-item write path / seed path
5. connect UI inbox to `/v1/work-items`
