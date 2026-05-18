# First BPMN process

This repo now includes the first actual BPMN definition:

- `workflows/bpmn/architecture-flow-v1.bpmn20.xml`

## Why this first process is intentionally simple

The app already has a visible work-item state model:

- `new`
- `triaged`
- `in_progress`
- `review`
- `done`

The first BPMN process mirrors that instead of inventing a more complex process too early.

That is the right move.
The first job is to prove state ownership and workflow orchestration, not to cosplay enterprise BPMN.

## Process shape

1. **Start event** — new intake detected
2. **Service task** — classify intake
3. **User task** — triage work item
4. **Gateway** — API/YAML-related or not
5. **Service task** — generate/refresh PDF for YAML/API paths
6. **User task** — produce working artifacts
7. **User task** — review and approve
8. **Gateway** — approved or needs rework
9. **End event** — done

## State mapping

| App status | BPMN step |
| --- | --- |
| `new` | start event / before triage |
| `triaged` | triage user task completed |
| `in_progress` | produce working artifacts user task |
| `review` | review and approve user task |
| `done` | end event |

## Worker topics assumed by the BPMN file

The BPMN file currently assumes these external-worker topics:

- `intake.classify`
- `artifact.render-pdf`

That does **not** mean they are integrated yet.
It means the process definition has named seams for the worker layer.

## What this process deliberately does not solve yet

- creating Flowable process instances from app work items
- syncing task state back into `workflow_runs` / `tasks`
- assigning real Flowable task owners from app users
- wiring UI actions to Flowable task completion
- handling blocked / clarification / timer states

## Next build step

The next real slice should be:

1. API service boundary for Flowable
2. create a workflow run when a work item enters the managed process
3. persist process instance id into `workflow_runs`
4. move app status changes behind workflow-backed transitions
