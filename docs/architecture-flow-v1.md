# Architecture Flow v1

## Purpose

`Architecture Flow` is an internal architecture-workflow tool for turning messy intake documents into structured architecture and API artifacts with traceable workflow state.

The first goal is not to build a broad generic platform.
The first goal is to make a repeatable architecture pipeline actually usable:

- intake source material from Google Drive
- track work through a clear workflow
- generate KISS/final/API artifacts
- generate API specification PDFs from OpenAPI YAML
- keep status, ownership, and auditability in one place

---

## Problem

Current architecture work has the usual failure modes:

- source documents arrive in inconsistent formats
- status lives in people’s heads or chat threads
- transformations from source -> KISS -> final -> OpenAPI are manual and fragile
- PDF generation is detached from workflow state
- file storage exists, but process visibility does not
- consistency depends too much on the individual doing the work

This creates wasted time, uneven quality, and poor handoff clarity.

---

## Product thesis

The value is not "AI writes documents".

The value is:

- controlled intake
- visible workflow state
- reusable standards
- consistent outputs
- faster movement from source doc to reviewable artifact
- auditability across the whole chain

That makes this closer to an **architecture workflow manager** or **integration design operating system** than a simple document tool.

---

## Scope of v1

v1 should solve a narrow but real workflow.

### Intake sources

Monitor and process:

- `Data - NET/General designs`
- `Data - NET/API spec drop/YAML`

### v1 outputs

- work items with state
- source-file visibility
- generated PDF from OpenAPI YAML
- artifact linking across steps
- manual action triggers for later transformations

### v1 non-goals

Do **not** start with:

- public SaaS product architecture
- multi-tenancy
- billing
- broad collaboration features
- deep document editing in-browser
- complex enterprise RBAC
- over-automated end-to-end generation with no review gates

---

## Recommended architecture

### Frontend

- **Next.js**
- **Tailwind CSS**
- **shadcn/ui**

Reason:
- fast internal-tool development
- strong component ecosystem
- easy authenticated dashboard patterns

### Backend API

- **NestJS**

Reason:
- clear modular structure
- good fit for long-lived backend code
- predictable service/controller patterns

### Database

- **PostgreSQL**

Reason:
- durable relational core
- easy audit/event modeling
- boring in the good way

### Workflow engine

- **Flowable OSS**

Reason:
- BPMN-native
- open source
- good fit for human tasks + service tasks + timers

Alternative:
- Camunda 7 community

### BPMN modeling

- **bpmn-js**

Reason:
- industry-standard browser BPMN modeler/viewer
- can support both diagram display and admin editing later

### Auth

- **Authentik**

Reason:
- lighter and cleaner than overcommitting to Keycloak too early
- good fit for internal SSO-style usage

Alternative:
- Keycloak if heavier enterprise requirements appear

### Background jobs

- **Redis + BullMQ**

Reason:
- simple async execution
- retries
- queue visibility

### Object/file storage

- **MinIO**

Reason:
- open source S3-compatible object storage
- keeps artifacts in a controlled durable store

### Rendering

- existing OpenAPI renderer path built in `work-architecture-playbook`
- Redoc/Redocly + headless browser for PDF generation

### AI orchestration

- **OpenClaw** as the orchestration/agent layer

Reason:
- keeps generation behavior out of the app core
- easier to evolve prompts/workflows without rebuilding the whole product

---

## High-level system design

### Main components

#### 1. Web app

Used by architects/reviewers to:

- see queues
- inspect work items
- review artifacts
- trigger generation steps
- approve/reject outputs

#### 2. API service

Responsible for:

- CRUD for work items
- artifact metadata
- user/task state
- workflow coordination endpoints

#### 3. Workflow service

Responsible for:

- BPMN process execution
- state transitions
- user task assignment
- timer-driven work
- failure/retry handling

#### 4. Drive sync worker

Responsible for:

- polling watched Google Drive folders
- creating work items from newly seen files
- syncing artifacts back where required

#### 5. Rendering worker

Responsible for:

- OpenAPI YAML -> PDF generation
- render retries/errors
- artifact upload/storage

#### 6. AI generation worker

Responsible for:

- KISS draft generation
- final design draft generation
- OpenAPI draft generation
- structured result capture from OpenClaw-assisted steps

---

## Workflow model

This is exactly where BPMN is justified.

The process is real, multi-step, and mixes automation with human review.

### Core BPMN flow

1. **Start event**: new file detected
2. **Service task**: classify intake
3. **User task**: confirm metadata / work-item framing
4. **Service task**: generate KISS draft
5. **User task**: review KISS draft
6. **Service task**: generate final design draft
7. **User task**: review final design
8. **Gateway**:
   - if API-related -> generate OpenAPI
   - otherwise skip
9. **Service task**: generate PDF artifact
10. **User task**: approve artifacts
11. **End event**: completed

### Error/exception paths

Boundary events or explicit failure states for:

- unreadable input
- missing required context
- failed generation
- failed render
- rejected review
- waiting on human clarification

---

## Data model

### `work_items`

- `id`
- `title`
- `source_type`
- `source_folder`
- `source_file_id`
- `source_link`
- `customer`
- `domain`
- `workflow_status`
- `priority`
- `assigned_to`
- `created_at`
- `updated_at`

### `artifacts`

- `id`
- `work_item_id`
- `artifact_type`
  - `source`
  - `kiss`
  - `final_design`
  - `openapi`
  - `pdf`
- `storage_backend`
  - `drive`
  - `minio`
  - `github`
- `storage_path`
- `drive_file_id`
- `version`
- `created_at`

### `workflow_runs`

- `id`
- `work_item_id`
- `process_definition_key`
- `process_instance_id`
- `status`
- `started_at`
- `ended_at`

### `tasks`

- `id`
- `work_item_id`
- `workflow_run_id`
- `task_type`
- `assigned_to`
- `status`
- `payload_json`
- `due_at`

### `comments`

- `id`
- `work_item_id`
- `author`
- `body`
- `created_at`

### `audit_events`

- `id`
- `work_item_id`
- `event_type`
- `actor`
- `payload_json`
- `created_at`

---

## UI structure

### 1. Inbox

Shows newly detected inputs from watched folders.

Columns/filters:

- source folder
- customer/domain
- detected time
- status
- assigned owner

### 2. Work item detail

Shows:

- source file
- metadata
- workflow state
- artifact list
- task history
- comments
- audit trail
- action buttons

### 3. Pipeline board

Suggested columns:

- New
- In progress
- Waiting review
- Blocked
- Done

### 4. Artifact view

Shows:

- source document link
- KISS output
- final design output
- OpenAPI YAML
- PDF output
- version lineage

### 5. Admin/workflow config

Manages:

- watched folders
- workflow templates
- generation templates/prompts
- PDF branding config
- engine settings

### 6. BPMN designer/admin screen

Admin-only.

Used to:

- view process definitions
- edit workflows later
- version workflow diagrams

---

## Storage approach

Use a hybrid storage model.

### Source of truth by concern

- **workflow/application state** -> PostgreSQL
- **large binary or generated artifact storage** -> MinIO
- **work-in-context collaboration files** -> Google Drive
- **durable templates/tooling/process docs** -> GitHub repo(s)

That avoids turning Drive into the app database.

---

## Security/auth model

### v1

- Google or company SSO through Authentik
- internal-only access
- simple roles:
  - admin
  - architect
  - reviewer

### Do not overbuild yet

- no deep custom permissions matrix in v1
- no external customer access in v1

---

## Observability

Need from the start:

- structured logs
- per-work-item audit trail
- workflow step history
- failed task visibility
- rerun capability

Nice later:

- metrics dashboard
- failure trend reporting
- throughput/lead-time reporting

---

## Deployment shape

### Simple first deployment

- Docker Compose or small VPS/container host
- Next.js app
- NestJS API
- PostgreSQL
- Redis
- MinIO
- Flowable

### Later if needed

- Kubernetes
- managed Postgres
- managed Redis
- external S3-compatible storage

Do not start with k8s unless there is an actual operational need.

---

## Why this can become a real product

Architects are buried in:

- consultant sludge
- inconsistent documents
- repeated transformation work
- weak traceability
- bad handoffs to API contracts

If this system reduces that pain reliably, it is not just an internal dashboard.
It is a real productivity product.

The moat is not generic AI.
The moat is:

- structured workflow
- domain-specific standards
- consistent artifact chain
- integrated reviewability
- operational reliability

---

## Recommended next build step

Build v1 in this order:

1. repo/app scaffold
2. auth
3. work-item model
4. inbox page
5. Drive polling into work items
6. artifact pages
7. PDF generation action
8. BPMN-backed workflow states
9. KISS/final/OpenAPI trigger actions

That is enough to prove the product.
