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

## Intake status now

The worker now has a first real one-shot Drive intake sync path:

- intake source config lives in DB (`intake_sources`)
- intake discovery events live in DB (`intake_events`)
- worker command: `pnpm --filter @architecture-flow/worker sync:intake`
- current fetch layer is `gog drive`

This is intentionally a pull-based bootstrap, not a final event architecture.
The goal is to prove the real ingestion backbone before adding queues/webhooks.

## Next build slice

1. run local infra via `docker-compose`
2. run `pnpm db:migrate`
3. run `pnpm db:seed`
4. start API + web shells
5. confirm inbox renders seeded `work_items`
6. run `pnpm --filter @architecture-flow/worker sync:intake`
7. confirm real Drive files appear as `work_items`
8. confirm Flowable REST answers before wiring BPMN/app integration

## Commands

```bash
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm --filter @architecture-flow/api dev
pnpm --filter @architecture-flow/web dev
pnpm --filter @architecture-flow/worker sync:intake
curl -u admin:test http://localhost:8080/flowable-rest/service/management/engine
```

## Flowable bootstrap notes

Local dev now includes a `flowable` container via `flowable/flowable-rest`.
The container bootstraps the REST API admin user through the documented `flowable.rest.app.admin.*` properties exposed as environment variables.

Expected local defaults:

- base URL: `http://localhost:8080/flowable-rest`
- username: `admin`
- password: `test`

This is intentionally just the bootstrap step.
We have not yet:

- deployed a BPMN definition
- created workflow instances from app work items
- synced Flowable task state back into `work_items`
