# NestJS + PostgreSQL + Prisma API

A type-safe RESTful API for team/task collaboration, built with **NestJS 11**, **TypeScript**, **PostgreSQL**, and **Prisma ORM 7**. Features JWT authentication with per-device session tracking and rotation, two-layer role-based access control (global admin/user + workspace admin/member), and a full Workspace → Members → Projects → Tasks → Comments resource hierarchy.

This is the NestJS leg of a "same app, three backends" learning series — the same TaskFlow domain rebuilt across Express + MongoDB/Mongoose, Express + PostgreSQL/Prisma, and this project, to build depth across ORMs, frameworks, and architectural styles rather than tutorial-hop between them.

---

## 📂 Project Structure

```
nest-with-postgress-prisma/
├── prisma/
│   ├── schema.prisma            # generator + datasource only
│   ├── models/                  # per-model schema files (multi-file schema)
│   │   ├── user.prisma
│   │   ├── session.prisma
│   │   ├── workspace.prisma
│   │   ├── workspace-member.prisma
│   │   ├── project.prisma
│   │   ├── task.prisma
│   │   └── comment.prisma
│   └── migrations/              # auto-generated SQL migration history
├── src/
│   ├── generated/prisma/        # generated Prisma Client (gitignored)
│   ├── prisma/                  # PrismaService + PrismaModule (global)
│   ├── common/
│   │   ├── decorators/          # @CurrentUser, @Roles
│   │   ├── guards/              # JwtAuthGuard, RolesGuard
│   │   ├── pipes/               # ParseUuidParamPipe
│   │   ├── filters/             # AllExceptionsFilter
│   │   ├── middleware/          # RequestLoggerMiddleware
│   │   └── utils/                # toSafeUser, user-provisioning helpers
│   ├── auth/                     # signup, signin, refresh, signout, change-password
│   ├── users/                    # self-profile + admin-only user listing
│   ├── workspaces/                # workspace CRUD (global-admin gated)
│   ├── workspace-members/         # invites, roles, password resets (workspace-admin gated)
│   ├── projects/                  # project CRUD (workspace-membership gated)
│   ├── tasks/                     # task CRUD, filtering/sorting/pagination
│   ├── comments/                  # comment CRUD (author-only edit/delete)
│   ├── app.module.ts
│   └── main.ts
├── test/
│   ├── utils/                    # createTestApp, signupTestUser test helpers
│   ├── setup-env.ts               # loads .env.test before the e2e suite boots
│   ├── jest-e2e.json
│   └── *.e2e-spec.ts              # one file per module
├── prisma.config.ts               # Prisma CLI config (schema path, migrations, DATABASE_URL)
├── .env.example
├── .env.test                      # e2e-only environment (separate DB, test secrets)
├── package.json
└── README.md
```

---

## ✨ Features

- **Type-safe queries** via Prisma Client (the newer `prisma-client` generator, not `prisma-client-js`), using the `@prisma/adapter-pg` driver adapter — required unconditionally in Prisma 7, regardless of database
- **JWT auth with real session tracking** — short-lived access tokens + long-lived refresh tokens backed by a `Session` table (not a simple `tokenVersion` flag), enabling per-device revocation. Refresh tokens **rotate** on every use: the old session is deleted and a new one issued, so a stolen-then-reused refresh token fails on its second use
- **Two-layer RBAC**:
  - Global `User.role` (`admin`/`user`) — gates workspace CRUD and the admin-only `GET /users` listing, via a reusable `@Roles()` decorator + `RolesGuard`
  - Per-workspace `WorkspaceMember.role` (`admin`/`member`) — gates member management, invites, and password resets within a specific workspace, checked in the service layer rather than a global guard
- **Workspace member invites** — inviting an existing user's email just adds them as a member; inviting an unregistered email auto-provisions a new account (username derived from the email's local part, with collision-safe suffixing) with a generated temporary password (`mustChangePassword: true`), returned once in the response for the admin to relay out-of-band
- **Password lifecycle** — self-service `PATCH /auth/change-password` and admin-triggered `POST /workspaces/:id/members/:userId/reset-password`, both of which hash a new password, clear/verify `mustChangePassword`, and **revoke all of that user's existing sessions** in one transaction
- **Consistent 404-not-403 pattern** — non-owners/non-members get the same 404 a nonexistent resource would, everywhere, to avoid leaking existence via ID probing
- **UUID validation at the route level** — a reusable `ParseUuidParamPipe` rejects malformed IDs with a clean `400` before they ever reach a query, instead of silently falling through to a `404`
- **Selective relation population** — e.g. comments return a nested `author: { id, fullName, username }` object (via Prisma's `select`, never a bare `include`) instead of a raw foreign-key id, without ever risking a leaked password hash
- **Swagger/OpenAPI docs** with a named bearer auth scheme, so the "Authorize" button in Swagger UI actually works end-to-end
- **Helmet, CORS, and per-route throttling** (`@nestjs/throttler`) baked in from `main.ts`, not deferred as a later hardening pass
- **Full test suite against a real, isolated Postgres database** — unit specs (Jest, mocked `PrismaService`) and e2e specs (Jest + Supertest, real DB) both pass consistently, with e2e running against a dedicated `_test` database via `.env.test`

---

## 🚀 Quick Start

### Prerequisites

- Node.js v20+
- pnpm
- PostgreSQL (local via Docker, or managed — e.g. Neon/Supabase)

### Installation & Setup

1. **Clone and install:**

   ```bash
   git clone https://github.com/ahmersdev/learning.git
   cd learning/nest-with-postgress-prisma
   pnpm install
   ```

2. **Start Postgres** (if running locally via Docker):

   ```bash
   docker compose up -d
   ```

3. **Environment configuration:**

   ```bash
   cp .env.example .env
   ```

   Required variables:

   ```env
   PORT=4000
   NODE_ENV=development
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
   JWT_ACCESS_SECRET="replace-with-a-long-random-string"
   JWT_REFRESH_SECRET="replace-with-a-different-long-random-string"
   JWT_ACCESS_EXPIRY="15m"
   JWT_REFRESH_EXPIRY="7d"
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nest_with_postgress?schema=public"
   ```

4. **Run migrations and generate the Prisma Client:**

   ```bash
   pnpm exec prisma migrate dev
   ```

5. **Start the dev server:**

   ```bash
   pnpm run start:dev
   ```

6. **Open Swagger docs:** `http://localhost:4000/api-docs` — click **Authorize**, paste a raw access token (no `Bearer` prefix needed), and every protected route becomes testable inline.

---

## 🛠️ Useful Commands

| Command                                       | Description                                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm run start:dev`                          | Starts the server in watch mode                                                                     |
| `pnpm test`                                   | Runs unit specs (Jest, mocked Prisma — no DB needed)                                                |
| `pnpm run test:e2e`                           | Runs the full e2e suite against the real `_test` database                                           |
| `pnpm run migrate:test`                       | Applies pending migrations to the `_test` database (`dotenv -e .env.test -- prisma migrate deploy`) |
| `pnpm exec prisma migrate dev --name <label>` | Creates and applies a new migration for any changes under `prisma/models/`                          |
| `pnpm exec prisma generate`                   | Regenerates the Prisma Client from the current schema, without touching the DB                      |
| `pnpm exec prisma studio`                     | Opens a browser UI to view/edit database records                                                    |

---

## 🧪 Testing

Unit specs run with everything mocked — no database required. e2e specs run against a **separate, real Postgres database** so tests never touch dev data.

**One-time setup:**

```bash
docker exec -it local-postgres psql -U postgres -c "CREATE DATABASE nest_with_postgress_test;"
pnpm run migrate:test
```

**Run the suites:**

```bash
pnpm test          # unit
pnpm run test:e2e  # e2e, against the _test database
```

`test/setup-env.ts` loads `.env.test` before Jest boots `AppModule`, so `PrismaService` connects to the test database rather than dev — this only works because it runs _before_ `ConfigModule`'s own `.env` load, and dotenv never overwrites a key that's already set.

---

## 📖 API Overview

Interactive API documentation (Swagger/OpenAPI) is available at `/api-docs` once the server is running.

**Resource hierarchy:** `Workspace` → `WorkspaceMember` → `Project` → `Task` → `Comment`, each scoped to its parent.

**Access model:**

- **Global `admin`** (default role on signup) — required for workspace CRUD and the admin-only `GET /users` endpoint
- **Workspace `admin`** — required for inviting/removing/re-roling workspace members and resetting a member's temporary password; the workspace **owner**'s own role/removal is additionally protected against even by other workspace admins
- **Workspace `member`** — full CRUD on projects and tasks within workspaces they belong to; comments are editable/deletable only by their original author, with no admin override

---

## ⚠️ Known Limitations

- `GET /users/:id` (single-user lookup by id) does not exist — only `GET /users/me` (self) and the admin-only `GET /users` (all users, unpaginated) are available
- No account deletion/deactivation endpoint exists for users
- List pagination/filtering/sorting is implemented for tasks only; workspaces, workspace members, projects, and comments return unbounded, unpaginated results
- `mustChangePassword` is informational only — returned to the frontend for UI redirect purposes, but not enforced server-side; a user with a temporary password can call any other authenticated route without first changing it
- No scheduled cleanup for expired `Session` rows — Postgres has no TTL index equivalent to Mongo's; expired sessions are correctly rejected at auth-check time but accumulate in the table until manually purged
- The e2e test database accumulates rows across runs with no automatic reset — never causes flaky failures since all test data is randomly/uniquely generated per run, but worth a `migrate reset` if it grows unwieldy
- Comment editing/deletion is strictly author-only with no admin override by design — if a comment's author account is deleted, the comment is preserved (`author: null`) but becomes permanently un-editable by anyone, including workspace admins
- Refresh-token role/permission data has up to a 15-minute staleness window (access token lifetime) — a role change (e.g. an admin downgraded to a regular member) doesn't take effect until the next token refresh or re-login, a deliberate tradeoff for a stateless-JWT design

---

## 📌 Development Workflow

1. **Add/modify a model:** edit or create a file under `prisma/models/`.
2. **Apply the change:** `pnpm exec prisma migrate dev --name <descriptive-label>`, then `pnpm run migrate:test` so the e2e database stays in sync — a migration that only lands on the dev DB will produce confusing e2e failures that have nothing to do with the actual code change.
3. **Prisma Client:** always inject `PrismaService` via Nest's DI (`@Global()` module, available everywhere without importing it per-module) — never instantiate `PrismaClient` directly; it's wired with the `@prisma/adapter-pg` driver adapter and CJS-compatible generator output, and a raw instantiation would skip both.
4. **New guarded routes:** reach for the existing `JwtAuthGuard` + `@Roles()`/`RolesGuard` pair for global-role gating, or the `assertCanAccessX`/`getRequesterRole` service-layer pattern for resource- or workspace-scoped checks — avoid inventing a third authorization style for consistency's sake.

---

## 🧩 Notable Prisma 7 / tooling gotchas (for future reference)

- **Prisma 7 requires a driver adapter unconditionally** — `new PrismaClient()` with no options throws at runtime; `PrismaPg` must be constructed from `DATABASE_URL` and passed in explicitly.
- **`moduleFormat = "cjs"`** is required in the generator block — the newer `prisma-client` generator defaults to ESM output, which crashes under a CommonJS Nest build with `exports is not defined in ES module scope`.
- **`importFileExtension = "ts"`** is required for Jest/ts-jest to resolve the generated client's internal imports — without it, Jest looks for `.js` files that don't exist alongside the `.ts` source.
- That same setting **breaks a real `tsc`/`nest build`**, which doesn't rewrite `.ts` import extensions to `.js` on its own — fixed via `"rewriteRelativeImportExtensions": true` in `tsconfig.json`, which in turn had to be **disabled specifically inside ts-jest's transform config** (`{ tsconfig: { rewriteRelativeImportExtensions: false } }`) since the two tools need opposite behavior from the same source files.
- **The default WASM query engine needs `--experimental-vm-modules`** to run under Jest at all (`NODE_OPTIONS=--experimental-vm-modules` in the `test:e2e` script) — a Jest/dynamic-import limitation, not a bug in either Prisma or this codebase.
