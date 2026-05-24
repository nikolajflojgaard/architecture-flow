# Production bootstrap

This is the first boring deployment target for Architecture Flow.

No platform cosplay.
No Kubernetes.
No service mesh.

Just one Linux VPS or Docker host with:

- reverse proxy in front
- Docker Compose for runtime
- persistent volumes for Postgres, Redis, and MinIO
- Authentik (or equivalent trusted auth proxy) forwarding identity headers to web/API

## First deployment target

Recommended v1 target:

- one boring VPS
- Docker Engine + Compose plugin
- reverse proxy/TLS handled outside this compose file

Why:

- fastest route to real usage
- easy to inspect
- easy to back up
- easy to rollback
- low operational complexity while the product is still evolving

## Current runtime topology

Today the production slice assumes these services:

- `web` — Next.js UI
- `api` — NestJS API
- `postgres` — primary app database
- `redis` — queue/cache primitive for later worker hardening
- `minio` — app-controlled artifact storage
- `flowable` — BPMN/workflow engine

### Important current limitation

There is a `worker` container definition, but the current runtime still shells out from the API into the worker package for service-task execution.

That means:

- the app is deployable now
- but worker execution is not yet a fully separated production service model

Treat separate worker runtime as the next hardening step, not as solved.

## Files added for production bootstrap

- `.env.production.example`
- `docker-compose.production.yml`
- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `apps/worker/Dockerfile`

## 1. Prepare the host

Install:

- Docker Engine
- Docker Compose plugin
- a reverse proxy or ingress layer that can terminate TLS

Suggested host baseline:

- Ubuntu 24.04 LTS
- 2-4 vCPU minimum
- 8 GB RAM minimum if Flowable + Chromium PDF rendering run on the same box
- SSD-backed persistent disk

## 2. Prepare environment file

Copy the example and fill real values:

```bash
cp .env.production.example .env.production
```

At minimum replace:

- `POSTGRES_PASSWORD`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `FLOWABLE_ADMIN_PASSWORD`
- `ARCHITECTURE_FLOW_PUBLIC_URL`
- `AUTHENTIK_ISSUER`
- `GOOGLE_DRIVE_ACCOUNT`

Set:

- `AUTH_MODE=header`

Do **not** leave `dev-bypass` or `disabled` enabled in production.

## 3. Build and start the stack

```bash
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

## 4. Run migrations and seed carefully

Run migrations:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml run --rm api pnpm db:migrate
```

Seed only if you intentionally want demo/bootstrap data:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml run --rm api pnpm db:seed
```

Do **not** seed blindly on a real environment.

## 5. Reverse proxy contract

The reverse proxy in front of the app must forward trusted identity headers to web/API:

- `x-authentik-email`
- `x-authentik-name`
- `x-authentik-groups`

Fallbacks also supported:

- `x-forwarded-email`
- `x-forwarded-user`
- `x-forwarded-groups`

These headers must only be trusted inside your internal deployment boundary.

## 6. Smoke test after boot

Check:

1. web loads
2. `GET /health` responds
3. `GET /v1/auth/me` shows the expected user in header mode
4. inbox loads work items
5. manual intake sync works for architect/admin, fails for reviewer
6. PDF render action still works with production `CHROME_BIN`

## 7. Backup expectations

You need real backups for:

- Postgres volume
- MinIO volume
- `.env.production` stored securely outside the host

Redis can be rebuilt if needed; Postgres and MinIO are the important state.

## 8. Current production gaps after this slice

Still not done:

- proper separate worker runtime instead of API shelling out to worker package
- reverse proxy config checked into repo
- automated restore drill / rollback script
- service-to-service auth story for worker/Flowable callbacks
- richer health/metrics endpoints

That is fine. This slice makes deployment concrete instead of theoretical.
