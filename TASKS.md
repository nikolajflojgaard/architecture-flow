# Architecture Flow task list

Use this file as the durable progress tracker.

Legend:
- [ ] not started
- [~] in progress
- [x] done
- [!] blocked / decision needed

## 0. Foundation

- [x] Create product direction docs
- [x] Create v1 architecture doc
- [x] Create v1 product spec
- [x] Create dedicated GitHub repo
- [ ] Define license / private-vs-public stance

## 1. Repo scaffold

- [x] Create monorepo structure
- [x] Add `apps/web`
- [x] Add `apps/api`
- [x] Add `apps/worker`
- [x] Add shared packages structure
- [x] Add Docker/dev environment

## 2. Core technical foundation

- [x] Choose package manager / workspace tooling
- [ ] Add linting / formatting / typechecking baseline
- [x] Add environment variable strategy
- [x] Add local dev startup instructions

## 2b. API foundation

- [x] Replace API bootstrap with NestJS structure
- [x] Add first DB-backed read endpoint for `work_items`
- [x] Add migrations/startup flow
- [x] Add seed/dev fixture path

## 3. Data model

- [x] Define `work_items`
- [x] Define `artifacts`
- [x] Define `workflow_runs`
- [x] Define `tasks`
- [x] Define `comments`
- [x] Define `audit_events`
- [x] Create first migration set

## 4. Auth

- [x] Set up Authentik integration design
- [x] Define roles: admin / architect / reviewer
- [x] Protect web app and API routes

## 5. Drive intake

- [x] Model watched folders in app config
- [x] Ingest `General designs`
- [x] Ingest `API spec drop/YAML`
- [x] Prevent duplicate re-ingestion
- [x] Persist intake events into DB
- [x] Expose intake status in API/UI
- [x] Add manual re-sync action

## 6. Work item UI

- [x] Inbox page
- [x] Work item detail page
- [ ] Pipeline board
- [x] Artifact list/view
- [x] Audit trail view

## 7. PDF artifact flow

- [x] Integrate existing OpenAPI PDF renderer
- [x] Link generated PDFs to work items
- [x] Retry / error handling for render failures

## 8. BPMN workflow

- [ ] Stand up Flowable OSS
- [ ] Define first BPMN process
- [ ] Map user tasks to UI actions
- [ ] Map service tasks to worker jobs
- [ ] Persist workflow state back into app DB

## 9. AI-assisted generation

- [ ] Define OpenClaw integration boundary
- [ ] KISS draft generation action
- [ ] Final design generation action
- [ ] OpenAPI draft generation action
- [ ] Store outputs as artifacts

## 10. Ops / observability

- [ ] Structured logging
- [ ] Failed job visibility
- [ ] Rerun action for failed steps
- [ ] Minimal metrics / health endpoints

## New tasks discovered during build

- [ ] Add source metadata enrichment rules (customer/domain inference from folder/file patterns)
- [ ] Move worker sync core into a shared internal package instead of API shell process execution
- [ ] Add API-side auth/guard around manual sync before exposing it beyond local dev

## Open questions

- [ ] Should this repo stay private initially?
- [ ] Should artifacts live primarily in Drive, MinIO, or hybrid from day one?
- [ ] Should the worker poll Drive only, or later move to webhook/event-driven ingestion?
- [ ] Should BPMN definitions live in repo files, DB, or both?

## Current recommendation

Build next in this order:

1. workflow-state actions from the UI
2. BPMN integration
3. source metadata enrichment
4. move worker sync core into a shared package
5. linting / formatting / typechecking baseline
6. comments + review handoff
