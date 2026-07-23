# TaskFlow API — Express + TypeScript Base Structure

A REST API skeleton for **TaskFlow**, a multi-tenant team task manager (Trello-lite). Built as a learning project to develop strong backend fundamentals — this repo is the DB-agnostic foundation that gets rebuilt three times on top of: **MongoDB**, **raw SQL (Postgres)**, and **Prisma (Postgres)**.

> **Status:** No database wired up yet. All services currently return stubbed data with `// TODO` markers indicating where real DB calls will go. Auth, validation, middleware, routing, and tests are fully built out.

---

## Tech Stack

- **Runtime:** Node.js, TypeScript (`nodenext` module resolution, native ESM)
- **Framework:** Express 5
- **Validation:** Zod
- **Auth:** JWT (access + refresh token pattern), httpOnly cookies for refresh tokens, bcrypt for password hashing
- **Security:** Helmet, CORS (origin whitelist), express-rate-limit
- **Docs:** Swagger (OpenAPI 3.0) via `swagger-jsdoc` + `swagger-ui-express`
- **Testing:** Jest + Supertest (ESM-compatible config via `ts-jest`)
- **Package manager:** pnpm

---

## Getting Started

### Prerequisites

- Node.js
- pnpm (`pnpm@11.13.0` or compatible)

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

# JWT stuff
JWT_ACCESS_SECRET=your-long-random-secret-for-access-tokens
JWT_REFRESH_SECRET=your-different-long-random-secret-for-refresh-tokens
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

Use two **different, long, random** secrets for access and refresh tokens — never reuse one for both.

### Run

```bash
pnpm dev     # watch mode, via tsx
pnpm start   # run once, no watch
```

Server starts on `http://localhost:4000` (or whatever `PORT` is set to).

### Test

```bash
pnpm test
```

Runs the full Jest + Supertest suite across all resources (auth, users, workspaces, workspace members, projects, tasks, comments).

### API Docs

Swagger UI is available once the server is running (mounted via `src/config/swagger.ts`), documenting all endpoints under the `/api/v1` prefix, with a `bearerAuth` security scheme for protected routes.

---

## Project Structure

```
src/
  config/
    swagger.ts                # OpenAPI spec + Swagger UI setup
  controllers/
    auth.controller.ts
    users.controller.ts
    workspaces.controller.ts
    workspace-members.controller.ts
    projects.controller.ts
    tasks.controller.ts
    comments.controller.ts
  middlewares/
    auth.middleware.ts        # JWT verification, protects routes
    error-handler.middleware.ts
    logger.middleware.ts
    rate-limiter.middleware.ts
    validate.middleware.ts    # Zod schema validation middleware
  routes/
    auth.routes.ts
    users.routes.ts
    workspaces.routes.ts
    workspace-members.routes.ts
    projects.routes.ts
    tasks.routes.ts
    comments.routes.ts
  schemas/
    users/schema.ts
    workspaces.schema.ts
    workspace-members.schema.ts
    projects.schema.ts
    tasks.schema.ts
    comments.schema.ts
  services/
    auth.service.ts
    users.service.ts
    workspaces.service.ts
    workspace-members.service.ts
    projects.service.ts
    tasks.service.ts
    comments.service.ts
  tests/
    auth.test.ts
    users.test.ts
    workspaces.test.ts
    workspace-members.test.ts
    projects.test.ts
    task.test.ts
    comments.test.ts
    setup.ts
  utils/
    app-error.ts               # Custom AppError / NotFoundError classes
    jwt.ts                      # Token generation/verification helpers
  app.ts
  server.ts
```

Each resource follows the same layered pattern: **schema → route → controller → service**. Controllers stay thin (HTTP only); services hold business logic and are the only layer that will change when the database is wired up.

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

This gives real one-to-many and many-to-many relationships — deliberately chosen to make SQL joins, Mongo embedding-vs-referencing decisions, and Prisma relations all meaningfully different across the three planned rebuilds.

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

Full request/response details are documented via Swagger. Task listing (`GET /projects/:projectId/tasks`) supports pagination (`page`, `limit`), filtering (`status`, `priority`, `assigneeId`), and sorting (`sortBy`, `sortOrder`) — the most fleshed-out list endpoint in the API.

---

## Current Coverage

**Implemented and working end-to-end (structure-complete, DB pending):**

- JWT access + refresh token auth flow, with httpOnly refresh cookie
- Centralized error handling (`AppError`, `NotFoundError`, global error middleware)
- Zod validation middleware on every mutating route
- Role-aware structure for workspace membership (admin vs member)
- Helmet, CORS (origin whitelist + credentials), rate limiting (general + strict auth limiter)
- Request logging middleware
- Full test suite across all resources
- Pagination, filtering, and sorting — implemented for tasks; not yet extended to other list endpoints

**Known gaps / intentionally deferred:**

- No database connection yet — all services return stubbed data
- Delete endpoints return `200` with a message body rather than `204 No Content` (deliberate choice, not a bug)
- Pagination/filtering not yet applied to workspace, project, or comment list endpoints

---

## Roadmap

This base structure will be rebuilt twice, swapping only the data-access layer inside each service, to compare approaches directly:

1. **MongoDB + Mongoose** — document modeling, embedding vs referencing, aggregation pipelines
2. **Prisma + Postgres** — schema-first ORM, migrations, type-safe relational queries

Routes, controllers, validation, and auth logic are designed to stay identical across both — only the service-layer implementation changes.
