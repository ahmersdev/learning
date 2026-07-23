# Express + MongoDB REST API

A TypeScript REST API built with Express 5 and MongoDB (via Mongoose), featuring JWT authentication with rotating refresh sessions, role-based access control, and a full workspace/project/task management resource hierarchy.

## Tech Stack

- **Runtime:** Node.js, TypeScript (ESM, NodeNext), [tsx](https://github.com/privatenumber/tsx) for dev/execution
- **Framework:** Express 5
- **Database:** MongoDB via Mongoose
- **Validation:** Zod
- **Auth:** JWT (access + refresh tokens), bcrypt password hashing
- **Docs:** Swagger / OpenAPI (`swagger-jsdoc` + `swagger-ui-express`)
- **Testing:** Jest + Supertest
- **Package manager:** pnpm

## Features

- **Authentication** — signup, signin, refresh, signout, change-password
  - Rotating refresh tokens backed by a real `Session` collection (each refresh issues a new session and invalidates the old one)
  - Multi-device support (independent sessions per login)
  - Signout revokes the session server-side, not just the client cookie
- **Authorization** — two-layer role-based access control
  - Platform-level roles (`admin` / `user`) gate workspace creation
  - Workspace-scoped roles (`admin` / `member`) gate membership management within a workspace
- **User provisioning** — admins can add workspace members by email; new accounts are auto-created with a generated username and a one-time temporary password (with forced password-change flow)
- **Resource hierarchy** — Workspaces → Workspace Members → Projects → Tasks → Comments, all backed by real MongoDB models with ownership/membership scoping
- **Task management** — filtering, sorting, and pagination on task lists; assignee validation and population (`assigneeDetails`)
- **Security practices**
  - Passwords hashed with bcrypt, never returned in API responses
  - Duplicate-key protection on unique fields (email, username, workspace membership)
  - `httpOnly` refresh token cookies
  - Rate limiting (general + stricter auth-specific limits)
  - Helmet security headers, CORS allowlist, request payload size limits
  - Consistent 404 (not 403) responses on unauthorized resource access, to avoid leaking resource existence
  - ObjectId format validation on all ID-based routes

## Project Structure

```

express-with-mongo/
├── src/
│ ├── config/ # DB connection, Swagger config
│ ├── controllers/ # Request handlers
│ ├── middlewares/ # Auth, validation, rate limiting, error handling, logging
│ ├── models/ # Mongoose schemas (User, Session, Workspace, WorkspaceMember, Project, Task, Comment)
│ ├── routes/ # Express route definitions + Swagger annotations
│ ├── schemas/ # Zod request validation schemas
│ ├── services/ # Business logic and database queries
│ ├── tests/ # Jest + Supertest integration tests
│ ├── utils/ # App errors, JWT helpers, user provisioning helpers
│ ├── app.ts # Express app setup
│ └── server.ts # Entry point, DB connection, graceful shutdown
├── .env # Environment variables (not committed)
├── jest.config.ts
├── package.json
└── tsconfig.json

```

## Prerequisites

- Node.js 18+
- pnpm
- MongoDB (running locally, e.g. via Homebrew or Docker)

## Setup

1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/ahmersdev/learning.git
   cd learning/express-with-mongo
   pnpm install
   ```

````

2. **Create a `.env` file** in the project root:

   ```dotenv
   # PORT
   PORT = 4000

   # Environment
   NODE_ENV = development

   # CORS - comma separated list of allowed origins
   ALLOWED_ORIGINS = http://localhost:3000,http://localhost:5173,http://localhost:4000

   # JWT stuff
   JWT_ACCESS_SECRET = your-long-random-secret-for-access-tokens
   JWT_REFRESH_SECRET = your-different-long-random-secret-for-refresh-tokens
   JWT_ACCESS_EXPIRY = 15m
   JWT_REFRESH_EXPIRY = 7d

   # MongoDB
   MONGODB_URI = mongodb://localhost:27017/express-with-mongo
   ```

   Replace the JWT secrets with real random values before using this outside local development.

3. **Start MongoDB** (if not already running):

   ```bash
   brew services start mongodb-community
   ```

4. **Run the dev server:**
   ```bash
   pnpm dev
   ```
   The API will be available at `http://localhost:4000`, with interactive docs at `http://localhost:4000/api-docs`.

## Available Scripts

| Command      | Description                                               |
| ------------ | --------------------------------------------------------- |
| `pnpm dev`   | Runs the server in watch mode via `tsx`                   |
| `pnpm start` | Runs the server once, no watch                            |
| `pnpm test`  | Runs the Jest test suite against a separate test database |

## API Overview

All routes are mounted under `/api/v1`.

| Resource          | Base path                  | Notes                                                        |
| ----------------- | -------------------------- | ------------------------------------------------------------ |
| Auth              | `/auth`                    | signup, signin, refresh, signout, change-password            |
| Users             | `/users`                   | profile (`/me`), admin-only list-all                         |
| Workspaces        | `/workspaces`              | owner-scoped CRUD, platform-admin only                       |
| Workspace Members | `/workspaces/:id/members`  | workspace-admin only, includes provisioning + password reset |
| Projects          | `/workspaces/:id/projects` | any workspace member                                         |
| Tasks             | `/projects/:id/tasks`      | filtering, sorting, pagination                               |
| Comments          | `/tasks/:id/comments`      | author-only edit/delete                                      |

Full request/response schemas are available via Swagger UI at `/api-docs` when running in a non-production environment.

## Testing

Tests run against a dedicated MongoDB database (`express-with-mongo-test`), separate from your dev database, and each test wipes all collections afterward for isolation.

```bash
pnpm test
```

## Known Limitations

- No cascade deletes — deleting a workspace, project, task, or user leaves child records (memberships, projects, tasks, comments) in place with dangling references rather than cleaning them up
- No `DELETE /users/:id` endpoint currently exists
- List pagination/filtering is implemented for tasks only; other list endpoints (workspaces, members, projects, comments) return unbounded results
- Logging is console-only — no structured or persistent logging is configured
- Comment editing/deletion is strictly author-only, with no admin override
````
