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

- [ ] Create monorepo structure
- [ ] Add `apps/web`
- [ ] Add `apps/api`
- [ ] Add `apps/worker`
- [ ] Add shared packages structure
- [ ] Add Docker/dev environment

## 2. Core technical foundation

- [ ] Choose package manager / workspace tooling
- [ ] Add linting / formatting / typechecking baseline
- [ ] Add environment variable strategy
- [ ] Add local dev startup instructions

## 3. Data model

- [ ] Define `work_items`
- [ ] Define `artifacts`
- [ ] Define `workflow_runs`
- [ ] Define `tasks`
- [ ] Define `comments`
- [ ] Define `audit_events`
- [ ] Create first migration set

## 4. Auth

- [ ] Set up Authentik integration design
- [ ] Define roles: admin / architect / reviewer
- [ ] Protect web app and API routes

## 5. Drive intake

- [ ] Model watched folders in app config
- [ ] Ingest `General designs`
- [ ] Ingest `API spec drop/YAML`
- [ ] Prevent duplicate re-ingestion
- [ ] Persist intake events into DB

## 6. Work item UI

- [ ] Inbox page
- [ ] Work item detail page
- [ ] Pipeline board
- [ ] Artifact list/view
- [ ] Audit trail view

## 7. PDF artifact flow

- [ ] Integrate existing OpenAPI PDF renderer
- [ ] Link generated PDFs to work items
- [ ] Retry / error handling for render failures

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

## Open questions

- [ ] Should this repo stay private initially?
- [ ] Should artifacts live primarily in Drive, MinIO, or hybrid from day one?
- [ ] Should the worker poll Drive only, or later move to webhook/event-driven ingestion?
- [ ] Should BPMN definitions live in repo files, DB, or both?

## Current recommendation

Build next in this order:

1. monorepo scaffold
2. DB schema
3. auth shell
4. inbox/work-item UI shell
5. Drive ingestion into DB
6. PDF artifact flow
7. BPMN integration
