import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import app from "../app.ts";

let userCounter = 0;

const makeUniqueUser = () => {
  userCounter += 1;
  return {
    fullName: `Test User ${userCounter}`,
    username: `commentuser${userCounter}`,
    email: `commentuser${userCounter}@example.com`,
    password: "Password1!",
  };
};

const signupAndGetToken = async (user = makeUniqueUser()): Promise<string> => {
  const res = await request(app).post("/api/v1/auth/signup").send(user);
  return res.body.data.accessToken;
};

const createTaskAsAdmin = async (): Promise<{
  accessToken: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
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
  const projectId = projectRes.body.data.project.id;

  const taskRes = await request(app)
    .post(`/api/v1/projects/${projectId}/tasks`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ title: "Test Task" });
  const taskId = taskRes.body.data.task.id;

  return { accessToken, workspaceId, projectId, taskId };
};

describe("Comment routes", () => {
  describe("POST /api/v1/tasks/:taskId/comments", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post("/api/v1/tasks/000000000000000000000000/comments")
        .send({ content: "Great work" });

      expect(res.status).toBe(401);
    });

    it("returns 400 for a malformed taskId", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/tasks/not-a-valid-id/comments")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "Great work" });

      expect(res.status).toBe(400);
    });

    it("returns 404 when the task doesn't exist", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/tasks/000000000000000000000000/comments")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "Great work" });

      expect(res.status).toBe(404);
    });

    it("returns 404 when the requester isn't a member of the task's workspace", async () => {
      const { taskId } = await createTaskAsAdmin();
      const outsiderToken = await signupAndGetToken();

      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .send({ content: "Great work" });

      expect(res.status).toBe(404);
    });

    it("returns 400 when content is missing", async () => {
      const { accessToken, taskId } = await createTaskAsAdmin();

      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 400 when content is empty string", async () => {
      const { accessToken, taskId } = await createTaskAsAdmin();

      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "" });

      expect(res.status).toBe(400);
    });

    it("creates a comment with valid content, attributed to the requester", async () => {
      const { accessToken, taskId } = await createTaskAsAdmin();

      const meRes = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`);

      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "Great work on this!" });

      expect(res.status).toBe(201);
      expect(res.body.data.comment.content).toBe("Great work on this!");
      expect(res.body.data.comment.authorId).toBe(meRes.body.data.user.id);
      expect(res.body.data.comment.taskId).toBe(taskId);
    });
  });

  describe("GET /api/v1/tasks/:taskId/comments", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get(
        "/api/v1/tasks/000000000000000000000000/comments",
      );
      expect(res.status).toBe(401);
    });

    it("returns comments in oldest-first order", async () => {
      const { accessToken, taskId } = await createTaskAsAdmin();

      await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "First comment" });

      await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "Second comment" });

      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.comments).toHaveLength(2);
      expect(res.body.data.comments[0].content).toBe("First comment");
      expect(res.body.data.comments[1].content).toBe("Second comment");
    });
  });

  describe("PATCH /api/v1/tasks/:taskId/comments/:commentId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch(
          "/api/v1/tasks/000000000000000000000000/comments/000000000000000000000000",
        )
        .send({ content: "Updated" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when content is missing", async () => {
      const { accessToken, taskId } = await createTaskAsAdmin();

      const createRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "Original" });

      const commentId = createRes.body.data.comment.id;

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/comments/${commentId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("updates a comment authored by the requester", async () => {
      const { accessToken, taskId } = await createTaskAsAdmin();

      const createRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "Original" });

      const commentId = createRes.body.data.comment.id;

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/comments/${commentId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "Edited comment" });

      expect(res.status).toBe(200);
      expect(res.body.data.comment.content).toBe("Edited comment");
    });

    it("returns 403 when a different workspace member tries to edit someone else's comment", async () => {
      const { accessToken, workspaceId, taskId } = await createTaskAsAdmin();

      const addRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "coworker@example.com", role: "member" });

      const coworkerSignin = await request(app)
        .post("/api/v1/auth/signin")
        .send({
          email: "coworker@example.com",
          password: addRes.body.data.temporaryPassword,
        });

      const createRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "Admin's comment" });

      const commentId = createRes.body.data.comment.id;

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/comments/${commentId}`)
        .set("Authorization", `Bearer ${coworkerSignin.body.data.accessToken}`)
        .send({ content: "Hijacked" });

      expect(res.status).toBe(403);
    });

    it("returns 404 for a nonexistent comment", async () => {
      const { accessToken, taskId } = await createTaskAsAdmin();

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/comments/000000000000000000000000`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "Edited" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/tasks/:taskId/comments/:commentId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        "/api/v1/tasks/000000000000000000000000/comments/000000000000000000000000",
      );
      expect(res.status).toBe(401);
    });

    it("deletes a comment authored by the requester", async () => {
      const { accessToken, taskId } = await createTaskAsAdmin();

      const createRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "To delete" });

      const commentId = createRes.body.data.comment.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/tasks/${taskId}/comments/${commentId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(deleteRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(getRes.body.data.comments).toHaveLength(0);
    });

    it("returns 403 when a different workspace member tries to delete someone else's comment", async () => {
      const { accessToken, workspaceId, taskId } = await createTaskAsAdmin();

      const addRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "coworker2@example.com", role: "member" });

      const coworkerSignin = await request(app)
        .post("/api/v1/auth/signin")
        .send({
          email: "coworker2@example.com",
          password: addRes.body.data.temporaryPassword,
        });

      const createRes = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ content: "Admin's comment" });

      const commentId = createRes.body.data.comment.id;

      const res = await request(app)
        .delete(`/api/v1/tasks/${taskId}/comments/${commentId}`)
        .set("Authorization", `Bearer ${coworkerSignin.body.data.accessToken}`)
        .send();

      expect(res.status).toBe(403);
    });
  });
});
