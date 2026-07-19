import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.ts";

const validAccessToken = jwt.sign(
  { userId: "abc123", email: "test@example.com" },
  process.env.JWT_ACCESS_SECRET!,
  { expiresIn: "15m" },
);

describe("Comment routes", () => {
  describe("POST /api/v1/tasks/:taskId/comments", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post("/api/v1/tasks/task-123/comments")
        .send({ content: "Great work" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when content is missing", async () => {
      const res = await request(app)
        .post("/api/v1/tasks/task-123/comments")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 400 when content is empty string", async () => {
      const res = await request(app)
        .post("/api/v1/tasks/task-123/comments")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ content: "" });

      expect(res.status).toBe(400);
    });

    it("creates a comment with valid content", async () => {
      const res = await request(app)
        .post("/api/v1/tasks/task-123/comments")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ content: "Great work on this!" });

      expect(res.status).toBe(201);
      expect(res.body.data.comment.content).toBe("Great work on this!");
      expect(res.body.data.comment.authorId).toBe("abc123");
      expect(res.body.data.comment.taskId).toBe("task-123");
    });
  });

  describe("GET /api/v1/tasks/:taskId/comments", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get("/api/v1/tasks/task-123/comments");
      expect(res.status).toBe(401);
    });

    it("returns a list of comments with a valid token", async () => {
      const res = await request(app)
        .get("/api/v1/tasks/task-123/comments")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.comments)).toBe(true);
    });
  });

  describe("PATCH /api/v1/tasks/:taskId/comments/:commentId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch("/api/v1/tasks/task-123/comments/comment-456")
        .send({ content: "Updated" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when content is missing", async () => {
      const res = await request(app)
        .patch("/api/v1/tasks/task-123/comments/comment-456")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 400 when content is empty string", async () => {
      const res = await request(app)
        .patch("/api/v1/tasks/task-123/comments/comment-456")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ content: "" });

      expect(res.status).toBe(400);
    });

    it("updates a comment with valid content", async () => {
      const res = await request(app)
        .patch("/api/v1/tasks/task-123/comments/comment-456")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ content: "Edited comment" });

      expect(res.status).toBe(200);
      expect(res.body.data.comment.content).toBe("Edited comment");
    });
  });

  describe("DELETE /api/v1/tasks/:taskId/comments/:commentId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        "/api/v1/tasks/task-123/comments/comment-456",
      );
      expect(res.status).toBe(401);
    });

    it("deletes a comment with a valid token", async () => {
      const res = await request(app)
        .delete("/api/v1/tasks/task-123/comments/comment-456")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
    });
  });
});
