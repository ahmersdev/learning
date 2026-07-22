import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import app from "../app.ts";
import { prisma } from "../config/db.ts";

const OWNER_EMAIL = "workspaces-owner@example.com";
const OWNER_USERNAME = "workspacesowner";

const OTHER_EMAIL = "workspaces-other@example.com";
const OTHER_USERNAME = "workspacesother";

const NON_ADMIN_EMAIL = "workspaces-nonadmin@example.com";
const NON_ADMIN_USERNAME = "workspacesnonadmin";

let nonAdminToken: string;
let ownerId: string;
let ownerToken: string;
let otherToken: string;

const cleanup = () =>
  prisma.user.deleteMany({
    where: {
      OR: [
        { email: { in: [OWNER_EMAIL, OTHER_EMAIL, NON_ADMIN_EMAIL] } },
        {
          username: {
            in: [OWNER_USERNAME, OTHER_USERNAME, NON_ADMIN_USERNAME],
          },
        },
      ],
    },
  });

describe("Workspace routes", () => {
  beforeAll(async () => {
    await cleanup();

    const owner = await prisma.user.create({
      data: {
        fullName: "Workspace Owner",
        username: OWNER_USERNAME,
        email: OWNER_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });
    ownerId = owner.id;

    const other = await prisma.user.create({
      data: {
        fullName: "Other User",
        username: OTHER_USERNAME,
        email: OTHER_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });

    const nonAdmin = await prisma.user.create({
      data: {
        fullName: "Non Admin",
        username: NON_ADMIN_USERNAME,
        email: NON_ADMIN_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "user", // explicitly non-admin — no signup flow produces this anymore
        mustChangePassword: false,
      },
    });

    ownerToken = jwt.sign(
      {
        userId: owner.id,
        email: owner.email,
        username: owner.username,
        fullName: owner.fullName,
        role: owner.role,
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "15m" },
    );

    otherToken = jwt.sign(
      {
        userId: other.id,
        email: other.email,
        username: other.username,
        fullName: other.fullName,
        role: other.role,
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "15m" },
    );

    nonAdminToken = jwt.sign(
      {
        userId: nonAdmin.id,
        email: nonAdmin.email,
        username: nonAdmin.username,
        fullName: nonAdmin.fullName,
        role: nonAdmin.role,
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "15m" },
    );
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  describe("Admin-only access", () => {
    it("returns 403 on POST for a non-admin user", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${nonAdminToken}`)
        .send({ name: "Should Not Be Created" });

      expect(res.status).toBe(403);
    });

    it("returns 403 on GET list for a non-admin user", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces")
        .set("Authorization", `Bearer ${nonAdminToken}`);

      expect(res.status).toBe(403);
    });

    it("returns 403 on GET by id for a non-admin user", async () => {
      const workspace = await prisma.workspace.create({
        data: { name: "Admin Only Workspace", ownerId },
      });

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspace.id}`)
        .set("Authorization", `Bearer ${nonAdminToken}`);

      expect(res.status).toBe(403);
    });

    it("returns 403 on PATCH for a non-admin user", async () => {
      const workspace = await prisma.workspace.create({
        data: { name: "Admin Only Workspace", ownerId },
      });

      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspace.id}`)
        .set("Authorization", `Bearer ${nonAdminToken}`)
        .send({ name: "Hijacked" });

      expect(res.status).toBe(403);
    });

    it("returns 403 on DELETE for a non-admin user", async () => {
      const workspace = await prisma.workspace.create({
        data: { name: "Admin Only Workspace", ownerId },
      });

      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspace.id}`)
        .set("Authorization", `Bearer ${nonAdminToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/v1/workspaces", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .send({ name: "Marketing Team" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when name is missing", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ description: "No name provided" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when name is empty string", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when an unknown field is sent", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Marketing Team", owner: "someone-else" });

      expect(res.status).toBe(400);
    });

    it("creates a workspace with valid data, persisted in the DB", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "Marketing Team",
          description: "For the marketing team",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.workspace.name).toBe("Marketing Team");
      expect(res.body.data.workspace.ownerId).toBe(ownerId);

      const dbWorkspace = await prisma.workspace.findUnique({
        where: { id: res.body.data.workspace.id },
      });
      expect(dbWorkspace).not.toBeNull();
    });

    it("creates a workspace without a description", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "No Description Workspace" });

      expect(res.status).toBe(201);
      expect(res.body.data.workspace.description).toBeNull();
    });
  });

  describe("GET /api/v1/workspaces", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get("/api/v1/workspaces");
      expect(res.status).toBe(401);
    });

    it("returns only workspaces owned by the requesting user", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.workspaces)).toBe(true);
      expect(
        res.body.data.workspaces.every(
          (w: { ownerId: string }) => w.ownerId === ownerId,
        ),
      ).toBe(true);
    });

    it("returns an empty list for a user with no workspaces", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces")
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workspaces).toEqual([]);
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId", () => {
    let workspaceId: string;

    beforeAll(async () => {
      const workspace = await prisma.workspace.create({
        data: { name: "Fetchable Workspace", ownerId },
      });
      workspaceId = workspace.id;
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app).get(`/api/v1/workspaces/${workspaceId}`);
      expect(res.status).toBe(401);
    });

    it("returns the workspace for its owner", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workspace.id).toBe(workspaceId);
    });

    it("returns 404 for a non-owner (existence not leaked)", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 404 for a workspace id that doesn't exist", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${crypto.randomUUID()}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/workspaces/:workspaceId", () => {
    let workspaceId: string;

    beforeAll(async () => {
      const workspace = await prisma.workspace.create({
        data: { name: "Patchable Workspace", ownerId },
      });
      workspaceId = workspace.id;
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .send({ name: "New Name" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when body is empty", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 404 when a non-owner attempts to patch", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ name: "Hijacked" });

      expect(res.status).toBe(404);
    });

    it("updates name only, persisted in the DB", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Renamed Workspace" });

      expect(res.status).toBe(200);
      expect(res.body.data.workspace.name).toBe("Renamed Workspace");

      const dbWorkspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      expect(dbWorkspace?.name).toBe("Renamed Workspace");
    });

    it("updates description only", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ description: "Updated description" });

      expect(res.status).toBe(200);
      expect(res.body.data.workspace.description).toBe("Updated description");
    });
  });

  describe("DELETE /api/v1/workspaces/:workspaceId", () => {
    let workspaceId: string;

    beforeAll(async () => {
      const workspace = await prisma.workspace.create({
        data: { name: "Deletable Workspace", ownerId },
      });
      workspaceId = workspace.id;
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        `/api/v1/workspaces/${workspaceId}`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 404 when a non-owner attempts to delete", async () => {
      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });

    it("deletes the workspace for its owner, removed from the DB", async () => {
      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");

      const dbWorkspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      expect(dbWorkspace).toBeNull();
    });
  });
});
