# Architecture Flow

Architecture Flow is an internal workflow tool for architects.

It is meant to turn messy intake documents and API-spec work into a visible, managed pipeline with clear states, durable artifacts, and less manual sludge.

## What problem this solves

Architecture work usually breaks in the same places:

- source documents arrive in inconsistent formats
- status lives in chat or in people’s heads
- KISS rewrites, final designs, YAML, and PDFs are loosely connected
- review/approval is unclear
- artifact generation is manual and fragile

Architecture Flow is meant to fix that with a real workflow system.

## v1 scope

The first version is intentionally narrow.

It should:

- ingest new files from Google Drive intake folders
- create visible work items
- track workflow state
- generate PDF artifacts from OpenAPI YAML
- support manual triggers for KISS / final design / OpenAPI generation
- keep audit history and ownership visible

## Current intake sources

- `Data - NET/General designs`
- `Data - NET/API spec drop/YAML`

## Current product direction

Recommended stack:

- **Frontend:** Next.js + Tailwind + shadcn/ui
- **Backend:** NestJS
- **Database:** PostgreSQL
- **Workflow engine:** Flowable OSS
- **BPMN UI:** bpmn-js
- **Auth:** Authentik
- **Background jobs:** Redis + BullMQ
- **Object storage:** MinIO
- **AI orchestration:** OpenClaw

## Repo structure

```txt
apps/
  web/
  api/
  worker/
packages/
  db/
  shared/
docs/
docker-compose.yml
```

## Docs

- `docs/architecture-flow-v1.md`
- `docs/architecture-flow-product-spec.md`
- `docs/development-bootstrap.md`
- `TASKS.md`

## Working principles

- build an actual workflow tool, not more disconnected scripts
- use open source components where practical
- keep the architecture boring and durable
- avoid enterprise cosplay before the workflow is proven
- prefer visible state and artifact traceability over cleverness

## Status

This repo currently holds:

- product direction
- system architecture notes
- v1 product spec
- task tracking
- local Flowable/infra bootstrap for the first BPMN slice

## Bootstrap status

The repo now includes:

- monorepo scaffold
- app shells
- initial database schema
- local dev infra starter

Next step is to wire the first real vertical slice through DB + UI + intake.

## Workflow engine bootstrap

Local dev now includes a Flowable REST container in `docker-compose.yml`.

Default local endpoints:

- Flowable REST: `http://localhost:8080/flowable-rest`
- default admin user: `admin`
- default admin password: `test`

This is only the engine bootstrap.
The repo still needs:

- the first BPMN definition
- app-to-Flowable integration
- mapping between work-item states and workflow instance state
