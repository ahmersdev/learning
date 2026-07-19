import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.ts";

const validAccessToken = jwt.sign(
  { userId: "abc123", email: "test@example.com" },
  process.env.JWT_ACCESS_SECRET!,
  { expiresIn: "15m" },
);

describe("Task routes", () => {
  describe("POST /api/v1/projects/:projectId/tasks", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post("/api/v1/projects/proj-123/tasks")
        .send({ title: "Design homepage" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when title is missing", async () => {
      const res = await request(app)
        .post("/api/v1/projects/proj-123/tasks")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ description: "No title" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid status", async () => {
      const res = await request(app)
        .post("/api/v1/projects/proj-123/tasks")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ title: "Task", status: "not-a-status" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid priority", async () => {
      const res = await request(app)
        .post("/api/v1/projects/proj-123/tasks")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ title: "Task", priority: "critical" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid dueDate", async () => {
      const res = await request(app)
        .post("/api/v1/projects/proj-123/tasks")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ title: "Task", dueDate: "not-a-date" });

      expect(res.status).toBe(400);
    });

    it("creates a task with just a title", async () => {
      const res = await request(app)
        .post("/api/v1/projects/proj-123/tasks")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ title: "Design homepage" });

      expect(res.status).toBe(201);
      expect(res.body.data.task.title).toBe("Design homepage");
      expect(res.body.data.task.status).toBe("backlog");
      expect(res.body.data.task.priority).toBe("medium");
    });

    it("creates a task with all fields", async () => {
      const res = await request(app)
        .post("/api/v1/projects/proj-123/tasks")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({
          title: "Design homepage",
          description: "Full mockup with mobile view",
          status: "todo",
          priority: "high",
          dueDate: "2026-08-01T00:00:00.000Z",
          assigneeId: "user-999",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.task.status).toBe("todo");
      expect(res.body.data.task.priority).toBe("high");
      expect(res.body.data.task.assigneeId).toBe("user-999");
    });
  });

  describe("GET /api/v1/projects/:projectId/tasks", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get("/api/v1/projects/proj-123/tasks");
      expect(res.status).toBe(401);
    });

    it("returns tasks with default pagination", async () => {
      const res = await request(app)
        .get("/api/v1/projects/proj-123/tasks")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.tasks)).toBe(true);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(20);
    });

    it("applies status and priority filters", async () => {
      const res = await request(app)
        .get("/api/v1/projects/proj-123/tasks?status=done&priority=high")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks[0].status).toBe("done");
      expect(res.body.data.tasks[0].priority).toBe("high");
    });

    it("applies custom page and limit", async () => {
      const res = await request(app)
        .get("/api/v1/projects/proj-123/tasks?page=2&limit=5")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.pagination.limit).toBe(5);
    });

    it("returns 400 for an invalid status filter", async () => {
      const res = await request(app)
        .get("/api/v1/projects/proj-123/tasks?status=nonsense")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(400);
    });

    it("returns 400 when limit exceeds max", async () => {
      const res = await request(app)
        .get("/api/v1/projects/proj-123/tasks?limit=500")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/projects/:projectId/tasks/:taskId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get(
        "/api/v1/projects/proj-123/tasks/task-456",
      );
      expect(res.status).toBe(401);
    });

    it("returns a task with a valid token", async () => {
      const res = await request(app)
        .get("/api/v1/projects/proj-123/tasks/task-456")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.task.id).toBe("task-456");
    });
  });

  describe("PATCH /api/v1/projects/:projectId/tasks/:taskId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch("/api/v1/projects/proj-123/tasks/task-456")
        .send({ title: "New title" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when body is empty", async () => {
      const res = await request(app)
        .patch("/api/v1/projects/proj-123/tasks/task-456")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("updates status only", async () => {
      const res = await request(app)
        .patch("/api/v1/projects/proj-123/tasks/task-456")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ status: "done" });

      expect(res.status).toBe(200);
      expect(res.body.data.task.status).toBe("done");
    });
  });

  describe("DELETE /api/v1/projects/:projectId/tasks/:taskId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        "/api/v1/projects/proj-123/tasks/task-456",
      );
      expect(res.status).toBe(401);
    });

    it("deletes a task with a valid token", async () => {
      const res = await request(app)
        .delete("/api/v1/projects/proj-123/tasks/task-456")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
    });
  });
});
