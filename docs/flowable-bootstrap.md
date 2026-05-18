# Flowable bootstrap

This repo now includes the first local Flowable step: a `flowable-rest` container in `docker-compose.yml`.

## Purpose of this slice

This does **not** mean workflow orchestration is integrated yet.
It means local development now has a real BPMN engine available so the next slices can build against something concrete.

## Local defaults

- Base URL: `http://localhost:8080/flowable-rest`
- Admin user: `admin`
- Admin password: `test`
- Backing DB: the same local PostgreSQL container used by the app bootstrap

## Start it

```bash
docker compose up -d
```

## Sanity check

```bash
curl -u admin:test http://localhost:8080/flowable-rest/service/management/engine
```

If that answers, the engine is reachable.

The Docker setup bootstraps that REST user with the documented REST app admin properties (`flowable.rest.app.admin.user-id` / `flowable.rest.app.admin.password`) exposed as environment variables.

## What still needs to happen

1. add the first BPMN file to the repo
2. define the minimal process shape for a work item
3. decide what status changes stay app-owned vs workflow-owned
4. create a small service boundary in the API for Flowable calls
5. persist enough workflow instance/task metadata back into app tables

## Suggested first BPMN process

Keep it stupidly simple:

1. `new`
2. `triaged`
3. `in_progress`
4. `review`
5. `done`

That mirrors the current app state machine and avoids fake complexity.
The first BPMN integration should prove state ownership and task visibility before adding branches, loops, or async service-task sludge.
