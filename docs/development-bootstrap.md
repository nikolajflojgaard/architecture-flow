# Development bootstrap

## What exists now

The repo has been scaffolded as a monorepo with:

- `apps/web` — Next.js UI shell
- `apps/api` — Fastify API shell
- `apps/worker` — worker shell
- `packages/shared` — shared types/constants
- `packages/db` — database package + initial SQL schema

## Current choices

- workspace tool: `pnpm`
- task runner: `turbo`
- web: `Next.js`
- api: lightweight bootstrap now, can move to full NestJS structure next
- db: PostgreSQL with plain SQL migration starter

## Why the API is Fastify-first right now

The product direction still recommends NestJS.

The current bootstrap uses plain Fastify because it is the smallest runnable shell for the first commit.
If we keep going, the next clean move is either:

1. wrap Fastify inside NestJS, or
2. replace the API shell with full NestJS scaffolding

Recommendation: move to full NestJS in the next implementation slice.

## Next build slice

1. install dependencies
2. run the web/api shells locally
3. wire DB access
4. add work-item read models
5. replace API bootstrap with proper NestJS modules
