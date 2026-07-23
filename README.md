# TaskFlow — Backend Learning Repository

Same app, three backends. This repo is a hands-on comparison of building the same REST API — **TaskFlow**, a multi-tenant team task manager (Workspaces → Members → Projects → Tasks → Comments, JWT auth, role-based access control) — across a bare Express foundation, MongoDB, and PostgreSQL/Prisma. The goal: understand data-layer tradeoffs by building the _same_ thing three ways, not by reading about them.

Each subfolder has its own detailed README covering setup, features, and known limitations specific to that build.

---

## 📂 Repository Structure

```
learning/
├── base-structure-for-express/       # DB-agnostic Express + TS skeleton — auth, JWT, Zod validation, RBAC groundwork, no database
├── express-with-mongo/               # Full rebuild on MongoDB + Mongoose
├── express-with-postgress-prisma/    # Full rebuild on PostgreSQL + Prisma
└── README.md
```

---

## 📦 Modules Overview

### 1. [`base-structure-for-express/`](./base-structure-for-express)

- **Focus:** Backend foundation — no database
- **What it is:** The starting skeleton all other modules build on: Express 5, JWT auth (access + refresh), bcrypt hashing, Zod request validation, centralized error handling, Helmet, CORS, rate limiting, and Swagger docs — all with services stubbed out, no real persistence yet.
- **Best for:** Understanding the request/response pipeline, middleware ordering, and auth flow before any database enters the picture.

### 2. [`express-with-mongo/`](./express-with-mongo)

- **Focus:** NoSQL / document database
- **What it is:** The full TaskFlow API on MongoDB via Mongoose — rotating refresh-token sessions, two-layer RBAC (platform + workspace roles), admin-driven user provisioning, and the complete resource hierarchy backed by real collections.
- **Best for:** Document modeling, embedding vs. referencing, and Mongoose-specific patterns (population, aggregation pipelines).

### 3. [`express-with-postgress-prisma/`](./express-with-postgress-prisma)

- **Focus:** Relational database with a type-safe ORM
- **What it is:** The same TaskFlow API rebuilt on PostgreSQL with Prisma — per-device session tracking, the same two-layer RBAC, and fully typed queries via the `@prisma/adapter-pg` driver adapter.
- **Best for:** Relational schema design, migrations, and comparing Prisma's query API directly against the same features built in Mongoose.

---

## 🚀 Getting Started

### Prerequisites

- Node.js
- pnpm
- Git
- MongoDB (local or Atlas) — for the Mongo module
- PostgreSQL (local, Docker, or hosted) — for the Postgres/Prisma module

### Setup

```bash
git clone https://github.com/ahmersdev/learning.git
cd learning
```

Each module is self-contained — `cd` into the one you want and follow its own README:

```bash
cd express-with-postgress-prisma
pnpm install
cp .env.example .env   # fill in DATABASE_URL and JWT secrets
npx prisma migrate dev
pnpm dev
```

(Swap in `express-with-mongo` or `base-structure-for-express` and follow that module's README — setup steps differ slightly per module, particularly around environment variables and database provisioning.)

---

## 🛠️ Key Technologies

- **Runtime:** Node.js, TypeScript (ESM/NodeNext), `tsx`
- **Framework:** Express 5
- **Databases:** MongoDB (Mongoose), PostgreSQL (Prisma)
- **Auth:** JWT (access + refresh, rotating sessions), bcrypt
- **Validation:** Zod
- **Docs:** Swagger / OpenAPI
- **Testing:** Jest + Supertest
- **Package manager:** pnpm

---

## 📄 License

This repository is open-source and available for learning, customization, and project bootstrapping.
