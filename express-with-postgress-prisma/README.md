# Express.js + PostgreSQL + Prisma API

A type-safe RESTful API for team/task collaboration, built with **Express 5**, **TypeScript**, **PostgreSQL**, and **Prisma ORM**. Features JWT authentication with per-device session tracking, role-based access control (global admin/user + workspace admin/member), and a full Workspace → Members → Projects → Tasks → Comments resource hierarchy.

---

## 📂 Project Structure

```

express-with-postgress-prisma/
├── prisma/
│ ├── schema.prisma # generator + datasource only
│ ├── models/ # per-model schema files (prismaSchemaFolder)
│ │ ├── user.prisma
│ │ ├── session.prisma
│ │ ├── workspace.prisma
│ │ ├── workspace-member.prisma
│ │ ├── project.prisma
│ │ ├── task.prisma
│ │ └── comment.prisma
│ └── migrations/ # auto-generated SQL migration history
├── generated/prisma/ # generated Prisma Client (gitignored)
├── src/
│ ├── config/ # Prisma client singleton (db.ts)
│ ├── schemas/ # Zod request validation schemas
│ ├── services/ # business logic + Prisma queries
│ ├── controllers/ # route handlers
│ ├── routes/ # Express route definitions + Swagger docs
│ ├── middlewares/ # auth, admin/role checks, validation, rate limiting, error handling
│ ├── utils/ # JWT helpers, custom error classes, user provisioning
│ ├── tests/ # Jest + Supertest test suites
│ └── app.ts # Express app setup
├── prisma.config.ts # Prisma CLI config (schema path, migrations path, DATABASE_URL)
├── .env.example
├── package.json
└── README.md

```

---

## ✨ Features

- **Type-safe queries** via Prisma Client, using the `@prisma/adapter-pg` driver adapter
- **JWT auth** — short-lived access tokens + long-lived refresh tokens, with a `Session` table for per-device tracking and revocation (logout, password change, and reset-password all revoke sessions server-side)
- **Role-based access control** — two layers: a global `User.role` (`admin`/`user`) and a per-workspace `WorkspaceMember.role` (`admin`/`member`)
- **Workspace member invites** — inviting a new email auto-provisions a user account with a generated temporary password (`mustChangePassword: true`); inviting an existing user's email just adds them as a member
- **Zod request validation** on every mutating route
- **Rate limiting** — stricter limits on auth-sensitive routes (signup/signin/change-password/reset-password) vs. general routes
- **Consistent 404-not-403 pattern** — non-owners/non-members get the same 404 a nonexistent resource would, to avoid leaking existence
- **Swagger/OpenAPI docs** generated from route JSDoc annotations
- **Prisma Studio** for local data inspection

---

## 🚀 Quick Start

### Prerequisites

- Node.js v18+
- pnpm
- PostgreSQL (local, Docker, or managed — e.g. Neon/Supabase)

### Installation & Setup

1. **Clone and install:**
   ```bash
   git clone https://github.com/ahmersdev/learning.git
   cd learning/express-with-postgress-prisma
   pnpm install
   ```

````

2. **Environment configuration:**

   ```bash
   cp .env.example .env
   ```

   Required variables:

   ```env
   PORT=5000
   DATABASE_URL="postgresql://username:password@localhost:5432/mydb?schema=public"
   JWT_ACCESS_SECRET="replace-with-a-long-random-string"
   JWT_REFRESH_SECRET="replace-with-a-different-long-random-string"
   JWT_ACCESS_EXPIRY="15m"
   JWT_REFRESH_EXPIRY="7d"
   ```

   The app throws on startup if either JWT secret is missing.

3. **Run migrations and generate the Prisma Client:**

   ```bash
   npx prisma migrate dev
   ```

4. **Start the dev server:**
   ```bash
   pnpm dev
   ```

---

## 🛠️ Useful Commands

| Command                                 | Description                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm dev`                              | Starts the server with auto-reload (`tsx --watch`)                             |
| `pnpm test`                             | Runs the Jest/Supertest test suite                                             |
| `npx prisma migrate dev --name <label>` | Creates and applies a new migration for any changes under `prisma/models/`     |
| `npx prisma generate`                   | Regenerates the Prisma Client from the current schema, without touching the DB |
| `npx prisma studio`                     | Opens a browser UI to view/edit database records                               |

---

## 🧪 Testing

Tests run against a **separate database** from dev, configured via `DATABASE_URL` override in `src/tests/setup.ts`. Create it once before running tests:

```bash
docker exec -it local-postgres psql -U postgres -c "CREATE DATABASE express_app_test;"
DATABASE_URL="postgresql://postgres:devpassword@localhost:5432/express_app_test?schema=public" npx prisma migrate deploy
```

Then:

```bash
pnpm test
```

---

## 📖 API Overview

Interactive API documentation (Swagger/OpenAPI) is available at `/api-docs` once the server is running.

**Resource hierarchy:** `Workspace` → `WorkspaceMember` → `Project` → `Task` → `Comment`, each scoped to its parent.

**Access model:**

- **Global `admin`** (default role on signup) — required for workspace CRUD and the admin-only `GET /users` endpoint
- **Workspace `admin`** — required for inviting/removing/re-roling workspace members and resetting a member's temporary password
- **Workspace `member`** — full CRUD on projects, tasks, and comments within workspaces they belong to; comments are editable/deletable only by their author

---

## ⚠️ Known Limitations

- `DELETE /users/:id` does not exist — there is currently no way to delete or deactivate a user account through the API
- `GET /users/:id` does not exist — only `GET /users/me` (self) and the admin-only `GET /users` (all users) are available; no single-user lookup by id
- List pagination/filtering/sorting is implemented for tasks only; workspaces, workspace members, projects, and comments return unbounded, unpaginated results
- `mustChangePassword` is informational only — it is returned to the frontend but not enforced server-side; a user with a temporary password can call any other route without first changing it
- Logging is console-only — no structured or persistent logging is configured
- Comment editing/deletion is strictly author-only, with no admin override — if a comment's author account is deleted, the comment is preserved (`authorId`/`author` set to `null`) but becomes permanently un-editable and un-deletable by anyone
- Expired sessions are not automatically cleaned up — Postgres has no TTL index equivalent to Mongo's; expired `Session` rows fail auth checks correctly but accumulate in the table until manually purged
- No production hardening pass yet — no `helmet`, CORS policy review, or health-check endpoint

---

## 📌 Development Workflow

1. **Add/modify a model:** edit or create a file under `prisma/models/`.
2. **Apply the change:** `npx prisma migrate dev --name <descriptive-label>` — one migration can capture multiple model changes if made together.
3. **Prisma Client:** always import the singleton from `src/config/db.ts` — never instantiate `new PrismaClient()` elsewhere; it's configured with the `@prisma/adapter-pg` driver adapter and won't work correctly otherwise.
````
