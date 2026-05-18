# Auth shell

This is the first real auth slice for Architecture Flow.

It is intentionally boring.

## Goal

Protect the app behind internal auth now, without pretending the full enterprise SSO flow is finished.

This slice should:

- define the Authentik integration boundary
- define the first role model
- protect web pages and API routes behind a consistent auth shell
- support a local-dev bypass so the product can still be built without standing up the whole identity stack first

## Authentik integration design

### v1 shape

- Authentik is the identity provider
- Architecture Flow sits behind a proxy or ingress that handles OIDC/OAuth with Authentik
- the proxy forwards trusted identity headers into the web/API runtime
- the app does not implement a custom login form
- the app trusts forwarded identity headers only inside the internal deployment boundary

### Expected forwarded headers

Primary headers to support:

- `x-authentik-email`
- `x-authentik-name`
- `x-authentik-groups`

Fallback headers to support:

- `x-forwarded-email`
- `x-forwarded-user`
- `x-forwarded-groups`

Group headers are expected as comma-separated values.

### Local development bypass

Local dev needs a clean bypass, otherwise auth blocks normal build speed.

Use:

- `AUTH_MODE=disabled` -> no auth checks, everything is treated as internal dev mode
- `AUTH_MODE=dev-bypass` -> app injects a configured dev user
- `AUTH_MODE=header` -> app requires forwarded identity headers

Dev-bypass envs:

- `ARCHITECTURE_FLOW_DEV_USER_EMAIL`
- `ARCHITECTURE_FLOW_DEV_USER_NAME`
- `ARCHITECTURE_FLOW_DEV_USER_ROLES`

## Roles

Keep it simple for v1.

### admin

Can do everything:

- change configuration
- trigger workflow actions
- rerun failed jobs
- manage role-sensitive operations

### architect

Default working role.

Can:

- view all work items
- view artifacts and audit trail
- trigger generation steps
- move workflow state through normal architecture flow
- comment and review

### reviewer

Can:

- view work items
- view artifacts
- comment
- approve/reject review steps

Cannot:

- change system configuration
- run admin-only operations

## Route protection policy

### API

Protect all `/v1/*` routes except:

- `/v1/auth/me`

Leave `/health` and `/v1/meta` open for operational checks.

### Web

Protect the app shell.

If auth is required and no trusted user is present:

- do not render normal product pages
- render a small auth-required screen instead

## Current limitation

This slice does not yet enforce role-specific permissions per action.

It enforces:

- authenticated vs unauthenticated access
- visible user/role context in the UI

Role-specific authorization should be added when write actions land.
