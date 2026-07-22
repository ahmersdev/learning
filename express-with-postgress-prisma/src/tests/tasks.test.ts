import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import app from "../app.ts";
import { prisma } from "../config/db.ts";

const OWNER_EMAIL = "tasks-owner@example.com";
const OWNER_USERNAME = "tasksowner";

const ASSIGNEE_EMAIL = "tasks-assignee@example.com";
const ASSIGNEE_USERNAME = "tasksassignee";

const OUTSIDER_EMAIL = "tasks-outsider@example.com";
const OUTSIDER_USERNAME = "tasksoutsider";

const NON_MEMBER_USER_EMAIL = "tasks-nonmemberuser@example.com";
const NON_MEMBER_USER_USERNAME = "tasksnonmemberuser";

const ALL_EMAILS = [
  OWNER_EMAIL,
  ASSIGNEE_EMAIL,
  OUTSIDER_EMAIL,
  NON_MEMBER_USER_EMAIL,
];
const ALL_USERNAMES = [
  OWNER_USERNAME,
  ASSIGNEE_USERNAME,
  OUTSIDER_USERNAME,
  NON_MEMBER_USER_USERNAME,
];

let ownerToken: string;
let outsiderToken: string;
let assigneeId: string;
let nonMemberUserId: string;
let workspaceId: string;
let projectId: string;

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

describe("Task routes", () => {
  beforeAll(async () => {
    await cleanup();

    const owner = await prisma.user.create({
      data: {
        fullName: "Tasks Owner",
        username: OWNER_USERNAME,
        email: OWNER_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });
    ownerToken = signToken(owner);

    const assignee = await prisma.user.create({
      data: {
        fullName: "Tasks Assignee",
        username: ASSIGNEE_USERNAME,
        email: ASSIGNEE_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });
    assigneeId = assignee.id;

    const outsider = await prisma.user.create({
      data: {
        fullName: "Tasks Outsider",
        username: OUTSIDER_USERNAME,
        email: OUTSIDER_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });
    outsiderToken = signToken(outsider);

    const nonMemberUser = await prisma.user.create({
      data: {
        fullName: "Non Member User",
        username: NON_MEMBER_USER_USERNAME,
        email: NON_MEMBER_USER_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });
    nonMemberUserId = nonMemberUser.id;

    const workspaceRes = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Tasks Test Workspace" });

    workspaceId = workspaceRes.body.data.workspace.id;

    await prisma.workspaceMember.create({
      data: { workspaceId, userId: assigneeId, role: "member" },
    });

    const projectRes = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Tasks Test Project" });

    projectId = projectRes.body.data.project.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  describe("POST /api/v1/projects/:projectId/tasks", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .send({ title: "Design homepage mockup" });

      expect(res.status).toBe(401);
    });

    it("returns 400 for a malformed projectId", async () => {
      const res = await request(app)
        .post("/api/v1/projects/not-a-uuid/tasks")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Design homepage mockup" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when title is missing", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ description: "No title" });

      expect(res.status).toBe(400);
    });

    it("returns 404 when the requester isn't a member of the project's workspace", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .send({ title: "Should Not Be Created" });

      expect(res.status).toBe(404);
    });

    it("returns 404 for a projectId that doesn't exist", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${crypto.randomUUID()}/tasks`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Should Not Be Created" });

      expect(res.status).toBe(404);
    });

    it("creates a task with only a title, defaulting status/priority", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Minimal Task" });

      expect(res.status).toBe(201);
      expect(res.body.data.task.status).toBe("backlog");
      expect(res.body.data.task.priority).toBe("medium");
      expect(res.body.data.task.assigneeId).toBeNull();
      expect(res.body.data.task.assignee).toBeNull();

      const dbTask = await prisma.task.findUnique({
        where: { id: res.body.data.task.id },
      });
      expect(dbTask).not.toBeNull();
    });

    it("creates a task with all fields, including a valid assigneeId", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Full Task",
          description: "Has everything",
          status: "in_progress",
          priority: "high",
          dueDate: "2026-12-31T00:00:00.000Z",
          assigneeId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.task.status).toBe("in_progress");
      expect(res.body.data.task.priority).toBe("high");
      expect(res.body.data.task.assigneeId).toBe(assigneeId);
      expect(res.body.data.task.assignee).toMatchObject({
        id: assigneeId,
        username: ASSIGNEE_USERNAME,
        email: ASSIGNEE_EMAIL,
      });
      expect(new Date(res.body.data.task.dueDate).toISOString()).toBe(
        "2026-12-31T00:00:00.000Z",
      );
    });

    it("returns 400 when assigneeId is not a member of the workspace", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Bad Assignee Task", assigneeId: nonMemberUserId });

      expect(res.status).toBe(400);
    });

    it("returns 400 when assigneeId doesn't correspond to any user", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Ghost Assignee Task",
          assigneeId: crypto.randomUUID(),
        });

      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid dueDate format", async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Bad Due Date Task", dueDate: "not-a-date" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/projects/:projectId/tasks", () => {
    beforeAll(async () => {
      await prisma.task.deleteMany({ where: { projectId } });

      await prisma.task.createMany({
        data: [
          {
            projectId,
            title: "Low Backlog",
            status: "backlog",
            priority: "low",
          },
          {
            projectId,
            title: "Medium Todo",
            status: "todo",
            priority: "medium",
          },
          {
            projectId,
            title: "High In Progress",
            status: "in_progress",
            priority: "high",
            assigneeId,
          },
          {
            projectId,
            title: "Urgent Blocked",
            status: "blocked",
            priority: "urgent",
            assigneeId,
          },
          { projectId, title: "Done Task", status: "done", priority: "medium" },
        ],
      });
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app).get(`/api/v1/projects/${projectId}/tasks`);
      expect(res.status).toBe(401);
    });

    it("returns 404 for a non-member", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });

    it("returns all tasks with default pagination", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks.length).toBe(5);
      expect(res.body.data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 5,
        totalPages: 1,
      });
    });

    it("filters by status", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks?status=done`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks.length).toBe(1);
      expect(res.body.data.tasks[0].title).toBe("Done Task");
    });

    it("filters by priority", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks?priority=urgent`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks.length).toBe(1);
      expect(res.body.data.tasks[0].title).toBe("Urgent Blocked");
    });

    it("filters by assigneeId", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks?assigneeId=${assigneeId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks.length).toBe(2);
      res.body.data.tasks.forEach(
        (task: { assignee: { id: string } | null }) => {
          expect(task.assignee?.id).toBe(assigneeId);
        },
      );
    });

    it("sorts by priority ascending (enum declaration order: low < medium < high < urgent)", async () => {
      const res = await request(app)
        .get(
          `/api/v1/projects/${projectId}/tasks?sortBy=priority&sortOrder=asc`,
        )
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      const priorities = res.body.data.tasks.map(
        (t: { priority: string }) => t.priority,
      );
      expect(priorities).toEqual(["low", "medium", "medium", "high", "urgent"]);
    });

    it("sorts by priority descending", async () => {
      const res = await request(app)
        .get(
          `/api/v1/projects/${projectId}/tasks?sortBy=priority&sortOrder=desc`,
        )
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      const priorities = res.body.data.tasks.map(
        (t: { priority: string }) => t.priority,
      );
      expect(priorities).toEqual(["urgent", "high", "medium", "medium", "low"]);
    });

    it("paginates with page and limit", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks?page=2&limit=2`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks.length).toBe(2);
      expect(res.body.data.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
    });

    it("returns totalPages: 1 with an empty result set for a filter that matches nothing", async () => {
      const res = await request(app)
        .get(
          `/api/v1/projects/${projectId}/tasks?status=backlog&priority=urgent`,
        )
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks).toEqual([]);
      expect(res.body.data.pagination.totalPages).toBe(1);
    });

    it("returns 400 for an invalid sortOrder value", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks?sortOrder=upward`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid status filter value", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks?status=not-a-status`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/projects/:projectId/tasks/:taskId", () => {
    let taskId: string;

    beforeAll(async () => {
      const task = await prisma.task.create({
        data: { projectId, title: "Fetchable Task" },
      });
      taskId = task.id;
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app).get(
        `/api/v1/projects/${projectId}/tasks/${taskId}`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 for a malformed taskId", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks/not-a-uuid`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
    });

    it("returns the task for a workspace member, with assignee populated", async () => {
      await prisma.task.update({
        where: { id: taskId },
        data: { assigneeId },
      });

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.task.id).toBe(taskId);
      expect(res.body.data.task.assignee).toMatchObject({
        id: assigneeId,
        username: ASSIGNEE_USERNAME,
      });
    });

    it("returns 404 for a non-member", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 404 for a taskId that belongs to a different project", async () => {
      const otherProjectRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Other Project For Isolation Test" });

      const otherProjectId = otherProjectRes.body.data.project.id;

      const res = await request(app)
        .get(`/api/v1/projects/${otherProjectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);

      await prisma.project.delete({ where: { id: otherProjectId } });
    });

    it("returns 404 for a taskId that doesn't exist", async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks/${crypto.randomUUID()}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/projects/:projectId/tasks/:taskId", () => {
    let taskId: string;

    beforeAll(async () => {
      const task = await prisma.task.create({
        data: { projectId, title: "Patchable Task" },
      });
      taskId = task.id;
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .send({ title: "New Title" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when body is empty", async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 404 for a non-member", async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .send({ title: "Hijacked" });

      expect(res.status).toBe(404);
    });

    it("returns 400 when patching to an assigneeId outside the workspace", async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ assigneeId: nonMemberUserId });

      expect(res.status).toBe(400);
    });

    it("updates status only, persisted in the DB", async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "in_review" });

      expect(res.status).toBe(200);
      expect(res.body.data.task.status).toBe("in_review");

      const dbTask = await prisma.task.findUnique({ where: { id: taskId } });
      expect(dbTask?.status).toBe("in_review");
    });

    it("updates assigneeId to a valid workspace member", async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ assigneeId });

      expect(res.status).toBe(200);
      expect(res.body.data.task.assigneeId).toBe(assigneeId);
      expect(res.body.data.task.assignee).toMatchObject({
        id: assigneeId,
        username: ASSIGNEE_USERNAME,
      });
    });
  });

  describe("DELETE /api/v1/projects/:projectId/tasks/:taskId", () => {
    let taskId: string;

    beforeAll(async () => {
      const task = await prisma.task.create({
        data: { projectId, title: "Deletable Task" },
      });
      taskId = task.id;
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        `/api/v1/projects/${projectId}/tasks/${taskId}`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 404 for a non-member", async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });

    it("deletes the task, removed from the DB", async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");

      const dbTask = await prisma.task.findUnique({ where: { id: taskId } });
      expect(dbTask).toBeNull();
    });
  });

  describe("Cascade behavior", () => {
    it("deletes all tasks when the parent project is deleted", async () => {
      const cascadeProjectRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Cascade Test Project" });

      const cascadeProjectId = cascadeProjectRes.body.data.project.id;

      const task = await prisma.task.create({
        data: { projectId: cascadeProjectId, title: "Should Be Cascaded" },
      });

      await request(app)
        .delete(
          `/api/v1/workspaces/${workspaceId}/projects/${cascadeProjectId}`,
        )
        .set("Authorization", `Bearer ${ownerToken}`);

      const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
      expect(dbTask).toBeNull();
    });

    it("sets assigneeId to null (not deleting the task) when the assigned user is deleted", async () => {
      const tempAssignee = await prisma.user.create({
        data: {
          fullName: "Temp Assignee",
          username: "taskstempassignee",
          email: "tasks-tempassignee@example.com",
          password: await bcrypt.hash("Password1!", 10),
          role: "admin",
          mustChangePassword: false,
        },
      });

      await prisma.workspaceMember.create({
        data: { workspaceId, userId: tempAssignee.id, role: "member" },
      });

      const task = await prisma.task.create({
        data: {
          projectId,
          title: "Assignee Deletion Test",
          assigneeId: tempAssignee.id,
        },
      });

      await prisma.user.delete({ where: { id: tempAssignee.id } });

      const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
      expect(dbTask).not.toBeNull();
      expect(dbTask?.assigneeId).toBeNull();
    });
  });
});
