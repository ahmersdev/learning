import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import app from "../app.ts";

let userCounter = 0;

const makeUniqueUser = () => {
  userCounter += 1;
  return {
    fullName: `Test User ${userCounter}`,
    username: `taskuser${userCounter}`,
    email: `taskuser${userCounter}@example.com`,
    password: "Password1!",
  };
};

const signupAndGetToken = async (user = makeUniqueUser()): Promise<string> => {
  const res = await request(app).post("/api/v1/auth/signup").send(user);
  return res.body.data.accessToken;
};

const createProjectAsAdmin = async (): Promise<{
  accessToken: string;
  workspaceId: string;
  projectId: string;
}> => {
  const accessToken = await signupAndGetToken();

  const workspaceRes = await request(app)
    .post("/api/v1/workspaces")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: "Test Workspace" });

  const workspaceId = workspaceRes.body.data.workspace.id;

  const projectRes = await request(app)
    .post(`/api/v1/workspaces/${workspaceId}/projects`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: "Test Project" });

  return {
    accessToken,
    workspaceId,
    projectId: projectRes.body.data.project.id,
  };
};

describe("Task routes", () => {
  describe("POST /api/v1/projects/:projectId/tasks", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post("/api/v1/projects/000000000000000000000000/tasks")
        .send({ title: "Design homepage" });

      expect(res.status).toBe(401);
    });

    it("returns 400 for a malformed projectId", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/projects/not-a-valid-id/tasks")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Design homepage" });

      expect(res.status).toBe(400);
    });

    it("returns 404 when the project doesn't exist", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/projects/000000000000000000000000/tasks")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Design homepage" });

      expect(res.status).toBe(404);
    });

    it("returns 404 when the requester isn't a member of the project's workspace", async () => {
      const { projectId } = await createProjectAsAdmin();
      const outsiderToken = await signupAndGetToken();

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .send({ title: "Design homepage" });

      expect(res.status).toBe(404);
    });

    it("returns 400 when title is missing", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ description: "No title" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid status", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Task", status: "not-a-status" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid dueDate", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Task", dueDate: "not-a-date" });

      expect(res.status).toBe(400);
    });

    it("creates a task with just a title, applying defaults", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Design homepage" });

      expect(res.status).toBe(201);
      expect(res.body.data.task.title).toBe("Design homepage");
      expect(res.body.data.task.status).toBe("backlog");
      expect(res.body.data.task.priority).toBe("medium");
      expect(res.body.data.task.projectId).toBe(projectId);
    });

    it("creates a task with all fields", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      const res = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          title: "Design homepage",
          description: "Full mockup",
          status: "todo",
          priority: "high",
          dueDate: "2026-08-01T00:00:00.000Z",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.task.status).toBe("todo");
      expect(res.body.data.task.priority).toBe("high");
      expect(res.body.data.task.dueDate).toBe("2026-08-01T00:00:00.000Z");
    });
  });

  describe("GET /api/v1/projects/:projectId/tasks", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get(
        "/api/v1/projects/000000000000000000000000/tasks",
      );
      expect(res.status).toBe(401);
    });

    it("returns tasks with default pagination, newest first", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "First" });

      await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Second" });

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks).toHaveLength(2);
      expect(res.body.data.tasks[0].title).toBe("Second"); // newest first
      expect(res.body.data.pagination.total).toBe(2);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(20);
    });

    it("applies status and priority filters", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Done Task", status: "done", priority: "high" });

      await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Todo Task", status: "todo", priority: "low" });

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks?status=done&priority=high`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks).toHaveLength(1);
      expect(res.body.data.tasks[0].title).toBe("Done Task");
    });

    it("sorts by title ascending when requested", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Zebra" });

      await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Apple" });

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks?sortBy=title&sortOrder=asc`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks[0].title).toBe("Apple");
      expect(res.body.data.tasks[1].title).toBe("Zebra");
    });

    it("sorts by title descending when requested", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Apple" });

      await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Zebra" });

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks?sortBy=title&sortOrder=desc`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks[0].title).toBe("Zebra");
      expect(res.body.data.tasks[1].title).toBe("Apple");
    });

    it("applies custom page and limit", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post(`/api/v1/projects/${projectId}/tasks`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ title: `Task ${i}` });
      }

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks?page=2&limit=2`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks).toHaveLength(2);
      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.total).toBe(5);
      expect(res.body.data.pagination.totalPages).toBe(3);
    });

    it("returns 400 for an invalid status filter", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks?status=nonsense`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
    });

    it("returns 400 when limit exceeds max", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks?limit=500`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/projects/:projectId/tasks/:taskId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get(
        "/api/v1/projects/000000000000000000000000/tasks/000000000000000000000000",
      );
      expect(res.status).toBe(401);
    });

    it("returns a task with a valid token", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      const createRes = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Design homepage" });

      const taskId = createRes.body.data.task.id;

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.task.id).toBe(taskId);
    });

    it("returns 404 for a task belonging to a different project", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();
      const { accessToken: otherAccessToken, projectId: otherProjectId } =
        await createProjectAsAdmin();

      const createRes = await request(app)
        .post(`/api/v1/projects/${otherProjectId}/tasks`)
        .set("Authorization", `Bearer ${otherAccessToken}`)
        .send({ title: "Not In This Project" });

      const taskId = createRes.body.data.task.id;

      const res = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/projects/:projectId/tasks/:taskId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch(
          "/api/v1/projects/000000000000000000000000/tasks/000000000000000000000000",
        )
        .send({ title: "New title" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when body is empty", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      const createRes = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Task" });

      const taskId = createRes.body.data.task.id;

      const res = await request(app)
        .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("updates status and persists it", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      const createRes = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Task" });

      const taskId = createRes.body.data.task.id;

      const patchRes = await request(app)
        .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ status: "done" });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.task.status).toBe("done");

      const getRes = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(getRes.body.data.task.status).toBe("done");
    });
  });

  describe("DELETE /api/v1/projects/:projectId/tasks/:taskId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        "/api/v1/projects/000000000000000000000000/tasks/000000000000000000000000",
      );
      expect(res.status).toBe(401);
    });

    it("deletes a task", async () => {
      const { accessToken, projectId } = await createProjectAsAdmin();

      const createRes = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "To Delete" });

      const taskId = createRes.body.data.task.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(deleteRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/v1/projects/${projectId}/tasks/${taskId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(getRes.status).toBe(404);
    });
  });
});
