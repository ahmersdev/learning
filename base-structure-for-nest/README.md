# TaskFlow API — NestJS Base Structure

A REST API skeleton for **TaskFlow**, a multi-tenant team task manager (Trello-lite). This is the NestJS rebuild of the [Express + TypeScript base structure](#) — same domain model, same endpoints, same validation rules — ported to compare how Nest's conventions (modules, DI, Guards, Pipes, Filters) differ from a hand-rolled Express + Zod setup.

> **Status:** No database wired up yet. All services currently return stubbed data with `// TODO` markers indicating where real DB calls will go. Auth, validation, guards, filters, routing, and tests are fully built out.

---

## Tech Stack

- **Runtime:** Node.js, TypeScript (`nodenext` module resolution)
- **Framework:** NestJS 11 (Express platform adapter)
- **Validation:** class-validator + class-transformer, wired via a global `ValidationPipe`
- **Auth:** JWT (access + refresh token pattern) via `@nestjs/jwt`, httpOnly cookies for refresh tokens, bcrypt for password hashing
- **Security:** Helmet, CORS (origin whitelist via `@nestjs/config`), `@nestjs/throttler` for rate limiting
- **Docs:** Swagger (OpenAPI 3.0) via `@nestjs/swagger`, decorator-driven (`@ApiProperty`, `@ApiOperation`, etc.)
- **Testing:** Jest + Supertest — unit specs (service/controller) and e2e specs per resource
- **Package manager:** pnpm

---

## Getting Started

### Prerequisites

- Node.js
- pnpm

### Install

```bash
pnpm install
```

### Environment variables

Create a `.env` file in the project root:

```dotenv
# PORT
PORT=4000

# Environment
NODE_ENV=development

# CORS - comma separated list of allowed origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:4000

# JWT stuff
JWT_ACCESS_SECRET=your-long-random-secret-for-access-tokens
JWT_REFRESH_SECRET=your-different-long-random-secret-for-refresh-tokens
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

Use two **different, long, random** secrets for access and refresh tokens — never reuse one for both.

### Run

```bash
pnpm start:dev   # watch mode
pnpm start       # run once, no watch
pnpm start:prod  # run compiled output from dist/
```

Server starts on `http://localhost:4000` (or whatever `PORT` is set to), under the `/api/v1` prefix.

### Test

```bash
pnpm test          # unit specs (service + controller, per resource)
pnpm test:e2e       # end-to-end specs, real HTTP requests via Supertest
pnpm test:cov       # unit specs with coverage report
```

Runs the full Jest suite across all resources (auth, users, workspaces, workspace members, projects, tasks, comments).

> `NODE_ENV=test` is set automatically for `test:e2e` so the throttler guard skips rate limiting during test runs.

### API Docs

Swagger UI is available once the server is running at `/api-docs`, documenting all endpoints under the `/api/v1` prefix, with a `bearerAuth` security scheme for protected routes. Request/response shapes are generated directly from DTO classes — no separate doc comments to keep in sync.

---

## Project Structure

```
src/
  app.module.ts                     # root module — wires ConfigModule, ThrottlerModule, filters, resource modules
  app.controller.ts / app.service.ts  # default Nest scaffold (health-check style root route)
  main.ts                           # bootstrap: helmet, cookie-parser, CORS, global prefix, ValidationPipe

  common/
    guards/
      jwt-auth.guard.ts             # verifies access token, populates request.user
      custom-throttler.guard.ts     # rate limiting: test-env skip + custom error shape
    decorators/
      current-user.decorator.ts     # @CurrentUser() — pulls the authenticated user off the request
    filters/
      all-exceptions.filter.ts      # global error handler — formats HttpException + unexpected errors
    middleware/
      request-logger.middleware.ts  # method/path/status/duration logging, redacts sensitive query params

  auth/
    dto/ (register.dto.ts, login.dto.ts)
    auth.controller.ts / auth.service.ts / auth.module.ts
    auth.controller.spec.ts / auth.service.spec.ts

  users/
    dto/update-user.dto.ts
    users.controller.ts / users.service.ts / users.module.ts
    users.controller.spec.ts / users.service.spec.ts

  workspaces/
    dto/ (create-workspace.dto.ts, update-workspace.dto.ts)
    workspaces.controller.ts / workspaces.service.ts / workspaces.module.ts
    workspaces.controller.spec.ts / workspaces.service.spec.ts

  workspace-members/
    dto/ (create-workspace-member.dto.ts, update-workspace-member.dto.ts)
    workspace-role.ts                 # shared WORKSPACE_ROLES constant + type
    workspace-members.controller.ts / workspace-members.service.ts / workspace-members.module.ts
    workspace-members.controller.spec.ts / workspace-members.service.spec.ts

  projects/
    dto/ (create-project.dto.ts, update-project.dto.ts)
    projects.controller.ts / projects.service.ts / projects.module.ts
    projects.controller.spec.ts / projects.service.spec.ts

  tasks/
    dto/ (create-task.dto.ts, update-task.dto.ts, task-query.dto.ts)
    task-enums.ts                     # shared TASK_STATUSES / TASK_PRIORITIES / sort constants + types
    tasks.controller.ts / tasks.service.ts / tasks.module.ts
    tasks.controller.spec.ts / tasks.service.spec.ts

  comments/
    dto/ (create-comment.dto.ts, update-comment.dto.ts)
    comments.controller.ts / comments.service.ts / comments.module.ts
    comments.controller.spec.ts / comments.service.spec.ts

test/
  utils/
    create-test-app.ts               # shared e2e bootstrap (cookie-parser, prefix, ValidationPipe)
    auth-helper.ts                   # signs up a throwaway user, returns access token + refresh cookie
  auth.e2e-spec.ts
  users.e2e-spec.ts
  workspaces.e2e-spec.ts
  workspace-members.e2e-spec.ts
  projects.e2e-spec.ts
  tasks.e2e-spec.ts
  comments.e2e-spec.ts
```

Each resource is a self-contained **feature module** (Nest convention) rather than organized by layer: DTOs, controller, service, module, and specs all live together in one folder. Controllers stay thin (HTTP + auth/ownership checks only); services hold business logic and are the only layer that will change when the database is wired up.

---

## Domain Model

```
User
 └── belongs to many Workspaces (via WorkspaceMember)

Workspace
 ├── has many WorkspaceMembers (role: admin | member)
 └── has many Projects

Project
 └── has many Tasks

Task
 ├── has status, priority, dueDate, assigneeId
 └── has many Comments

Comment
 └── belongs to a Task and a User
```

---

## API Overview

All routes are prefixed with `/api/v1`.

| Resource          | Base path                                |
| ----------------- | ---------------------------------------- |
| Auth              | `/auth` — signup, login, refresh, logout |
| Users             | `/users` — current user profile          |
| Workspaces        | `/workspaces`                            |
| Workspace Members | `/workspaces/:workspaceId/members`       |
| Projects          | `/workspaces/:workspaceId/projects`      |
| Tasks             | `/projects/:projectId/tasks`             |
| Comments          | `/tasks/:taskId/comments`                |

Full request/response details are documented via Swagger at `/api-docs`. Task listing (`GET /projects/:projectId/tasks`) supports pagination (`page`, `limit`), filtering (`status`, `priority`, `assigneeId`), and sorting (`sortBy`, `sortOrder`) — the most fleshed-out list endpoint in the API.

---

## Current Coverage

**Implemented and working end-to-end (structure-complete, DB pending):**

- JWT access + refresh token auth flow via `@nestjs/jwt`, with httpOnly refresh cookie
- Global exception filter (`AllExceptionsFilter`) — consistent `{ status, message, details? }` error shape across all thrown `HttpException`s, plus dev-mode stack traces and a fallback 500 handler for unexpected errors
- class-validator DTO validation on every mutating route and on task list query params, via a global `ValidationPipe` with a custom `exceptionFactory` for field-tagged validation errors
- `JwtAuthGuard` protecting all routes that require authentication, with a reusable `@CurrentUser()` decorator
- Role-aware structure for workspace membership (admin vs member), enforced in the service layer
- Helmet, CORS (origin whitelist via env, credentials-aware), rate limiting via `@nestjs/throttler` (global default + stricter per-route limits on auth endpoints, matching the original `authLimiter`/`refreshLimiter` values)
- Request logging middleware, redacts sensitive query params (tokens, passwords, secrets)
- Full test suite across all resources — unit specs (service + controller, mocked dependencies) and e2e specs (real HTTP requests against a fully bootstrapped app) per resource
- Pagination, filtering, and sorting — implemented for tasks (with proper string→number coercion on `page`/`limit` query params); not yet extended to other list endpoints

**Known gaps / intentionally deferred:**

- No database connection yet — all services return stubbed data
- Delete endpoints return `200` with a message body rather than `204 No Content` (deliberate choice, mirrors the Express version)
- Pagination/filtering not yet applied to workspace, project, or comment list endpoints
- Ownership/membership checks (`assertIsWorkspaceMember`, `assertCanAccessProject`, `assertCanAccessTask`, `assertIsCommentAuthor`, workspace-member role checks) are currently stubbed to always pass — real authorization logic lands with DB wiring
- No "admin" role enforcement on workspace-level admin-only endpoints yet — deferred until real user roles exist in the DB

---

## Roadmap

Once DB wiring is complete here, this base structure will be rebuilt further to compare data-access approaches directly:

1. **MongoDB + Mongoose** — document modeling, embedding vs referencing, aggregation pipelines
2. **Raw SQL + Postgres** — hand-written queries, joins, transactions
3. **Prisma + Postgres** — schema-first ORM, migrations, type-safe relational queries

Modules, DTOs, guards, and auth logic are designed to stay identical across all three — only the service-layer implementation changes.
