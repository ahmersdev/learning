import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import app from "../app.ts";
import { prisma } from "../config/db.ts";

const OWNER_EMAIL = "projects-owner@example.com";
const OWNER_USERNAME = "projectsowner";

const MEMBER_EMAIL = "projects-member@example.com";
const MEMBER_USERNAME = "projectsmember";

const OUTSIDER_EMAIL = "projects-outsider@example.com";
const OUTSIDER_USERNAME = "projectsoutsider";

const ALL_EMAILS = [OWNER_EMAIL, MEMBER_EMAIL, OUTSIDER_EMAIL];
const ALL_USERNAMES = [OWNER_USERNAME, MEMBER_USERNAME, OUTSIDER_USERNAME];

let ownerToken: string;
let memberToken: string;
let outsiderToken: string;
let workspaceId: string;

const cleanup = () =>
  prisma.user.deleteMany({
    where: {
      OR: [{ email: { in: ALL_EMAILS } }, { username: { in: ALL_USERNAMES } }],
    },
  });

const signToken = (user: {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
}) =>
  jwt.sign(
    {
      userId: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: "15m" },
  );

describe("Project routes", () => {
  beforeAll(async () => {
    await cleanup();

    const owner = await prisma.user.create({
      data: {
        fullName: "Projects Owner",
        username: OWNER_USERNAME,
        email: OWNER_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });
    ownerToken = signToken(owner);

    const member = await prisma.user.create({
      data: {
        fullName: "Projects Member",
        username: MEMBER_USERNAME,
        email: MEMBER_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });
    memberToken = signToken(member);

    const outsider = await prisma.user.create({
      data: {
        fullName: "Projects Outsider",
        username: OUTSIDER_USERNAME,
        email: OUTSIDER_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });
    outsiderToken = signToken(outsider);

    const workspaceRes = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Projects Test Workspace" });

    workspaceId = workspaceRes.body.data.workspace.id;

    // add `member` as a regular (non-admin) workspace member — the key case
    // for "Option A": non-admin members should still have full CRUD on projects
    await prisma.workspaceMember.create({
      data: { workspaceId, userId: member.id, role: "member" },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  describe("POST /api/v1/workspaces/:workspaceId/projects", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .send({ name: "Website Redesign" });

      expect(res.status).toBe(401);
    });

    it("returns 400 for a malformed workspaceId", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces/not-a-uuid/projects")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Website Redesign" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when name is missing", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ description: "No name" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when name is empty string", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "" });

      expect(res.status).toBe(400);
    });

    it("returns 404 when the requester isn't a member of the workspace", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .send({ name: "Should Not Be Created" });

      expect(res.status).toBe(404);
    });

    it("creates a project as the workspace owner (admin), persisted in the DB", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Website Redesign", description: "Q3 refresh" });

      expect(res.status).toBe(201);
      expect(res.body.data.project.name).toBe("Website Redesign");
      expect(res.body.data.project.workspaceId).toBe(workspaceId);

      const dbProject = await prisma.project.findUnique({
        where: { id: res.body.data.project.id },
      });
      expect(dbProject).not.toBeNull();
    });

    it("creates a project as a non-admin workspace member (Option A: any member can CRUD)", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Member Created Project" });

      expect(res.status).toBe(201);
      expect(res.body.data.project.name).toBe("Member Created Project");
    });

    it("creates a project without a description", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "No Description Project" });

      expect(res.status).toBe(201);
      expect(res.body.data.project.description).toBeNull();
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId/projects", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get(
        `/api/v1/workspaces/${workspaceId}/projects`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 404 for a non-member", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });

    it("returns the list of projects for a member", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.projects)).toBe(true);
      expect(res.body.data.projects.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId/projects/:projectId", () => {
    let projectId: string;

    beforeAll(async () => {
      const project = await prisma.project.create({
        data: { workspaceId, name: "Fetchable Project" },
      });
      projectId = project.id;
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app).get(
        `/api/v1/workspaces/${workspaceId}/projects/${projectId}`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 for a malformed projectId", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/not-a-uuid`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
    });

    it("returns the project for a workspace member", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.project.id).toBe(projectId);
    });

    it("returns 404 for a non-member", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 404 for a projectId that doesn't exist", async () => {
      const res = await request(app)
        .get(
          `/api/v1/workspaces/${workspaceId}/projects/${crypto.randomUUID()}`,
        )
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 404 for a projectId that belongs to a different workspace", async () => {
      const otherWorkspaceRes = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Other Workspace For Isolation Test" });

      const otherWorkspaceId = otherWorkspaceRes.body.data.workspace.id;

      const res = await request(app)
        .get(`/api/v1/workspaces/${otherWorkspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);

      await prisma.workspace.delete({ where: { id: otherWorkspaceId } });
    });
  });

  describe("PATCH /api/v1/workspaces/:workspaceId/projects/:projectId", () => {
    let projectId: string;

    beforeAll(async () => {
      const project = await prisma.project.create({
        data: { workspaceId, name: "Patchable Project" },
      });
      projectId = project.id;
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .send({ name: "New Name" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when body is empty", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 404 for a non-member", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .send({ name: "Hijacked" });

      expect(res.status).toBe(404);
    });

    it("updates the project as a non-admin member (Option A)", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ name: "Renamed Project" });

      expect(res.status).toBe(200);
      expect(res.body.data.project.name).toBe("Renamed Project");

      const dbProject = await prisma.project.findUnique({
        where: { id: projectId },
      });
      expect(dbProject?.name).toBe("Renamed Project");
    });

    it("updates description only", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ description: "Updated description" });

      expect(res.status).toBe(200);
      expect(res.body.data.project.description).toBe("Updated description");
    });
  });

  describe("DELETE /api/v1/workspaces/:workspaceId/projects/:projectId", () => {
    let projectId: string;

    beforeAll(async () => {
      const project = await prisma.project.create({
        data: { workspaceId, name: "Deletable Project" },
      });
      projectId = project.id;
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        `/api/v1/workspaces/${workspaceId}/projects/${projectId}`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 404 for a non-member", async () => {
      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });

    it("deletes the project as a non-admin member (Option A), removed from the DB", async () => {
      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");

      const dbProject = await prisma.project.findUnique({
        where: { id: projectId },
      });
      expect(dbProject).toBeNull();
    });
  });

  describe("Cascade behavior", () => {
    it("deletes all projects when the parent workspace is deleted", async () => {
      const cascadeWorkspaceRes = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Cascade Test Workspace" });

      const cascadeWorkspaceId = cascadeWorkspaceRes.body.data.workspace.id;

      const project = await prisma.project.create({
        data: { workspaceId: cascadeWorkspaceId, name: "Should Be Cascaded" },
      });

      await request(app)
        .delete(`/api/v1/workspaces/${cascadeWorkspaceId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      const dbProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(dbProject).toBeNull();
    });
  });
});
