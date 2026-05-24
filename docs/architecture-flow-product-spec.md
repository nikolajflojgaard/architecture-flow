# Architecture Flow v1 product spec

## Goal

Build a small internal workflow tool for architects that turns file-based intake and API-spec generation into a visible, manageable process.

v1 should be useful fast.
It should not try to be a giant platform.

---

## Primary users

### Architect

Needs to:

- see new incoming work
- understand status quickly
- review and improve generated outputs
- trigger next steps manually when needed

### Reviewer / lead

Needs to:

- review outputs
- approve/reject
- see bottlenecks
- inspect audit trail

### Admin

Needs to:

- manage watched folders
- manage workflow definitions
- manage integrations and prompts/templates

---

## v1 jobs to be done

1. When a new file lands in `General designs`, create a visible work item.
2. When a new file lands in `API spec drop/YAML`, generate a PDF and track it.
3. Let architects see all artifacts tied to a work item in one place.
4. Let architects trigger generation steps without juggling shell commands.
5. Preserve a clear status trail from intake to done.

---

## Core workflows

### Workflow A: new general-design intake

1. file appears in `General designs`
2. system creates work item
3. architect reviews intake metadata
4. architect can trigger KISS draft
5. architect can trigger final design draft
6. if API-related, architect can trigger OpenAPI draft
7. if YAML exists, architect can trigger PDF generation
8. work item moves to review/done

### Workflow B: API spec YAML drop

1. file appears in `API spec drop/YAML`
2. system creates or updates work item context
3. system generates PDF
4. PDF artifact is stored and linked
5. user gets notified

---

## Pages

### 1. Login

Simple internal login via SSO.

### 2. Inbox

Purpose:

- show newly detected work

Must show:

- title
- source folder
- detected time
- status
- owner

Must allow:

- open work item
- assign owner
- mark triaged

### 3. Work item detail

Purpose:

- central operating view for one case

Sections:

- overview
- source document links
- workflow state
- artifacts
- actions
- comments
- audit log

Actions:

- generate KISS draft
- generate final design draft
- generate OpenAPI draft
- generate PDF
- mark blocked
- mark approved

### 4. Pipeline board

Purpose:

- quick operational visibility

Columns:

- New
- Triaged
- In progress
- Waiting review
- Blocked
- Done

### 5. Admin

Purpose:

- manage system setup

Sections:

- watched folders
- prompt/template settings
- workflow definitions
- branding/PDF settings

---

## Functional requirements

### Intake

- detect newly seen files in configured Drive folders
- create work items from detected files
- avoid duplicate re-ingestion of already seen files

### Artifact management

- attach multiple artifact types to one work item
- show artifact version history
- store links to Drive/MinIO/GitHub locations

### Workflow

- every work item has a current status
- every transition is logged
- user tasks and automated tasks are distinguishable

### PDF generation

- new YAML in the watched folder can trigger PDF generation automatically
- PDF must be attached to the related work item
- failures must be visible and retryable

### Notifications

- notify only when meaningful events happen
- avoid spam for unchanged items

---

## Non-functional requirements

### Reliability

- retries for failed automated tasks
- idempotent intake detection
- no duplicate work-item creation for the same file

### Security

- internal-only access
- authenticated users only
- auditable actions

### Maintainability

- modular services
- clear integration boundaries
- workflow definitions versioned

### Observability

- logs for each job
- task-level error visibility
- per-item audit trail

---

## v1 acceptance criteria

### Intake acceptance

- when a new file is added to `General designs`, it appears as a new work item
- already-known files do not reappear as new work

### YAML/PDF acceptance

- when a new YAML file is added to `API spec drop/YAML`, a PDF is generated
- the generated PDF is linked to the work item and stored in the correct output location

### UI acceptance

- an architect can open a work item and see source + artifacts + status in one place
- an architect can trigger the next generation step without shell access

### Audit acceptance

- each automated action produces an audit event
- each human approval/rejection produces an audit event

---

## Suggested implementation order

### Slice 1

- app scaffold
- auth
- PostgreSQL schema
- inbox list
- work-item detail shell

### Slice 2

- Drive watcher ingestion
- baseline dedupe logic
- audit events

### Slice 3

- PDF generation action
- artifact storage model
- status transitions

### Slice 4

- BPMN integration
- user tasks + service tasks

### Slice 5

- OpenClaw-backed generation actions for KISS/final/OpenAPI

---

## Product principle

This tool should reduce architecture friction, not add more process theater.

If a screen or workflow step does not make intake, transformation, review, or traceability better, it should not exist.
