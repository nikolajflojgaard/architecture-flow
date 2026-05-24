# Architecture Flow task list

Use this file as the durable progress tracker.

Legend:

- [ ] not started
- [~] in progress
- [x] done
- [!] blocked / decision needed

---

## Current reality check

What is already real in the repo:

- monorepo scaffold is in place
- NestJS API shell exists
- Next.js web shell exists
- worker exists
- DB migrations and seed path exist
- Drive intake vertical slice exists
- Flowable bootstrap exists
- PDF generation path exists

What is still fake / soft:

- lint is not actually wired across the repo yet
- pipeline board is not shipped
- OpenClaw generation path is not defined as a clean system boundary yet
- failed-job operational visibility is still thin
- production deployment story is still mostly theory

---

## 0. Foundation

- [x] Create product direction docs
- [x] Create v1 architecture doc
- [x] Create v1 product spec
- [x] Create dedicated GitHub repo
- [!] Define license / private-vs-public stance
  - repo is currently public on GitHub while `package.json` is marked `private: true`
  - decide whether this is an internal tool shared publicly as source, or whether the whole repo should go private for now
  - if public: add real license + scrub internal assumptions from docs/env examples
  - if private: flip the GitHub repo private and stop pretending this is undecided

## 1. Repo scaffold

- [x] Create monorepo structure
- [x] Add `apps/web`
- [x] Add `apps/api`
- [x] Add `apps/worker`
- [x] Add shared packages structure
- [x] Add Docker/dev environment

## 2. Core technical foundation

- [x] Choose package manager / workspace tooling
- [x] Add linting / formatting / typechecking baseline
  - [x] Root `lint`, `format`, and `typecheck` scripts exist
  - [x] TypeScript compiles are wired per app/package
  - [x] Add root ESLint config
  - [x] Make `apps/web` lint non-interactive and committed
  - [x] Replace `echo 'lint not wired yet'` placeholders in API/worker/packages
  - [x] Add `format:check` script for CI/non-destructive validation
  - [x] Verify `pnpm lint && pnpm typecheck` passes cleanly from repo root
- [x] Add environment variable strategy
- [x] Add local dev startup instructions

## 2b. API foundation

- [x] Replace API bootstrap with NestJS structure
- [x] Add first DB-backed read endpoint for `work_items`
- [x] Add migrations/startup flow
- [x] Add seed/dev fixture path
- [ ] Add write endpoints for core work-item actions
- [ ] Add API contract for workflow action triggers
- [ ] Add API-side validation/error shape baseline

## 3. Data model

- [x] Define `work_items`
- [x] Define `artifacts`
- [x] Define `workflow_runs`
- [x] Define `tasks`
- [x] Define `comments`
- [x] Define `audit_events`
- [x] Create first migration set
- [ ] Add explicit owner/assignee update history rules
- [ ] Add artifact version semantics (`source`, `kiss`, `final`, `openapi`, `pdf`)
- [ ] Add workflow-task/result payload conventions

## 4. Auth

- [x] Set up Authentik integration design
- [x] Define roles: admin / architect / reviewer
- [x] Protect web app and API routes
- [ ] Add route-level permission matrix doc
- [ ] Add service-to-service auth story for worker -> API / Flowable callbacks

## 5. Drive intake

- [x] Model watched folders in app config
- [x] Ingest `General designs`
- [x] Ingest `API spec drop/YAML`
- [x] Prevent duplicate re-ingestion
- [x] Persist intake events into DB
- [x] Expose intake status in API/UI
- [x] Add manual re-sync action
- [ ] Add API-side auth/guard around manual sync before exposing it beyond local dev
- [ ] Add last-sync summary card to the web UI
- [ ] Add explicit duplicate/skip reason visibility in UI

## 6. Work item UI

- [x] Inbox page
- [x] Work item detail page
- [x] Workflow-state actions from the UI
- [x] Pipeline board
  - [x] Define board columns from real workflow states, not made-up UI labels
  - [x] Show item count per column
  - [x] Support drag/drop or explicit move actions
  - [x] Surface blocked reason and waiting-review owner inline
  - [x] Clicking a card opens the work item detail view
- [x] Artifact list/view
- [x] Audit trail view
- [ ] Add comments panel with create/reply flow
- [x] Add owner assignment control
- [ ] Add empty/loading/error states worth looking at

## 7. PDF artifact flow

- [x] Integrate existing OpenAPI PDF renderer
- [x] Link generated PDFs to work items
- [x] Retry / error handling for render failures
- [ ] Add manual rerender action in the UI
- [ ] Show source YAML -> PDF lineage clearly in artifact history
- [ ] Persist renderer stderr/stdout summary for support/debugging

## 8. BPMN workflow

- [x] Stand up Flowable OSS
- [x] Define first BPMN process
- [x] Map user tasks to UI actions
- [x] Map service tasks to worker jobs
- [x] Persist workflow state back into app DB
- [ ] Version BPMN definitions intentionally
- [ ] Decide source of truth for deployed BPMN definitions
- [ ] Add workflow-instance drilldown from work item detail
- [ ] Add retry/escalation behavior for stuck service tasks

## 9. AI-assisted generation

- [ ] Define OpenClaw integration boundary
  - [ ] Decide whether Architecture Flow calls OpenClaw via CLI, session/job API, or webhook-style adapter
  - [ ] Define what payload goes in (`work_item`, artifact refs, prompt template, desired output type)
  - [ ] Define what comes back (artifact body, status, logs, failure reason)
  - [ ] Define timeout/retry rules so the app does not hang on model calls
- [ ] KISS draft generation action
- [ ] Final design generation action
- [ ] OpenAPI draft generation action
- [ ] Store outputs as artifacts
- [ ] Add human review gate between each generated artifact stage
- [ ] Add prompt/template version tracking per generated artifact

## 10. Ops / observability

- [ ] Structured logging
  - [ ] pick log shape and correlation ID strategy
  - [ ] include `work_item_id`, `workflow_run_id`, and job name where relevant
- [ ] Failed job visibility
  - [ ] failed jobs list in UI
  - [ ] last error summary on work item detail
- [ ] Rerun action for failed steps
- [ ] Minimal metrics / health endpoints
  - [ ] `/health` for API
  - [ ] worker heartbeat / queue depth view
  - [ ] Flowable connectivity check

## 11. Deployment / runtime

- [ ] Choose first deployment target (single VPS vs Docker host vs Coolify/CapRover)
  - recommended default: start with one boring Docker host/VPS
- [ ] Define production runtime topology (web, api, worker, postgres, redis, minio, flowable)
- [ ] Add production compose/deployment manifests
- [ ] Add production environment variable template and secrets checklist
- [ ] Add persistent storage/backup plan for Postgres and MinIO
- [ ] Add reverse proxy / TLS entrypoint
- [ ] Add deployment bootstrap doc
- [ ] Add update/rollback procedure
- [ ] Add basic uptime/health monitoring for deployed services

## 12. CI / release hygiene

- [x] Add GitHub Actions workflow for install + lint + typecheck + build
- [x] Cache pnpm dependencies in CI
- [ ] Add PR checklist or template
- [ ] Add release notes/change log habit if this becomes shared outside your machine

## New tasks discovered during build

- [x] Add source metadata enrichment rules (customer/domain inference from folder/file patterns)
- [x] Move worker sync core into a shared internal package instead of API shell process execution
- [ ] Add API-side auth/guard around manual sync before exposing it beyond local dev
- [ ] Stop checking generated `.next` output into the repo if that is currently happening locally

## Open questions

- [!] Should this repo stay private initially?
  - recommendation: yes, until auth/integration assumptions are cleaned up
- [!] Should artifacts live primarily in Drive, MinIO, or hybrid from day one?
  - recommendation: hybrid; Drive for business-facing source/final exchange, MinIO for app-controlled artifact history
- [!] Should the worker poll Drive only, or later move to webhook/event-driven ingestion?
  - recommendation: poll first, event-driven later only if polling becomes painful
- [!] Should BPMN definitions live in repo files, DB, or both?
  - recommendation: repo as source of truth, deployed into engine
- [!] Which deployment target should v1 use first: simple VPS/Docker host, or a small platform like Coolify?
  - recommendation: simple VPS/Docker host first

## Recommended next build order

### Slice 1 — make the repo honest

1. wire ESLint properly and make root lint/typecheck pass
2. add basic CI so the repo stops lying about health
3. remove placeholder lint scripts and interactive setup traps

### Slice 2 — finish the operator view

4. finish pipeline board interactions (drag/drop or explicit move actions)
5. add comments panel with create/reply flow
6. add review handoff path instead of DB-only task completion

### Slice 3 — define the AI boundary before building AI buttons

7. define OpenClaw request/response contract
8. implement KISS generation end-to-end
9. persist generated artifact + audit trail
10. repeat the same pattern for final design and OpenAPI

### Slice 4 — make it deployable

11. choose boring VPS/Docker target
12. write production compose + env template + backup plan
13. add health checks and rollback doc

## Good first session later

If you just want one solid next working session, do this:

1. wire ESLint for the repo
2. make `pnpm lint && pnpm typecheck && pnpm build` pass cleanly
3. commit that as the “repo honesty” baseline
4. then start the pipeline board on top of a clean foundation

## Step-by-step implementation checklist — repo honesty baseline

Use this as the exact first execution pass.

### A. Stop the lint setup from being fake

- [x] Add a root ESLint config (`eslint.config.*` or `.eslintrc.*`)
- [x] Install the actual ESLint deps needed by the monorepo
- [x] Make sure Next.js linting is configured non-interactively in `apps/web`
- [x] Remove any first-run lint prompt behavior from `apps/web`
- [x] Replace every `echo 'lint not wired yet'` script with real lint commands

### B. Make lint commands real per workspace

- [x] `apps/web`: run real ESLint against app code
- [x] `apps/api`: run real ESLint against `src/**/*.ts`
- [x] `apps/worker`: run real ESLint against `src/**/*.ts`
- [x] `packages/db`: run real ESLint against `src/**/*.ts` and scripts if relevant
- [x] `packages/shared`: run real ESLint against `src/**/*.ts`
- [x] `packages/intake-sync`: run real ESLint against `src/**/*.ts`

### C. Add non-destructive quality gates

- [x] Add root `format:check` script
- [x] Keep root `format` as the fixing command
- [x] Verify root `lint` does not mutate files
- [x] Verify root `typecheck` does not rely on prior build output

### D. Run the truth test locally

Run these in order and do not lie about the results:

- [x] `pnpm install`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm build`

If one fails:

- [x] fix the actual issue
- [x] rerun the full chain, not just the failed command

### E. Clean up repo noise

- [x] Check whether `.next`, turbo logs, or other generated junk are unintentionally tracked or relied on
- [x] Tighten `.gitignore` if needed
- [x] Make sure the repo can pass the validation chain from a clean checkout

### F. Add CI immediately after local truth passes

- [x] Add GitHub Actions workflow for `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm build`
- [x] Cache pnpm store in CI
- [x] Make CI run on push + PR
- [ ] Verify CI passes from the current default branch

### G. Only then move on

Only after A–F are green:

- [ ] start pipeline board implementation
- [ ] avoid mixing AI-generation work into the same cleanup session
