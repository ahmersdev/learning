import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.ts";

const validAccessToken = jwt.sign(
  { userId: "abc123", email: "test@example.com" },
  process.env.JWT_ACCESS_SECRET!,
  { expiresIn: "15m" },
);

describe("Project routes", () => {
  describe("POST /api/v1/workspaces/:workspaceId/projects", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/projects")
        .send({ name: "Website Redesign" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when name is missing", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/projects")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ description: "No name" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when name is empty string", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/projects")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ name: "" });

      expect(res.status).toBe(400);
    });

    it("creates a project with valid data", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/projects")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ name: "Website Redesign", description: "Q3 refresh" });

      expect(res.status).toBe(201);
      expect(res.body.data.project.name).toBe("Website Redesign");
      expect(res.body.data.project.workspaceId).toBe("ws-123");
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId/projects", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get("/api/v1/workspaces/ws-123/projects");
      expect(res.status).toBe(401);
    });

    it("returns a list of projects with a valid token", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces/ws-123/projects")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.projects)).toBe(true);
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId/projects/:projectId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get(
        "/api/v1/workspaces/ws-123/projects/proj-456",
      );
      expect(res.status).toBe(401);
    });

    it("returns a project with a valid token", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces/ws-123/projects/proj-456")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.project.id).toBe("proj-456");
    });
  });

  describe("PATCH /api/v1/workspaces/:workspaceId/projects/:projectId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123/projects/proj-456")
        .send({ name: "New Name" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when body is empty", async () => {
      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123/projects/proj-456")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("updates name only", async () => {
      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123/projects/proj-456")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ name: "Renamed Project" });

      expect(res.status).toBe(200);
      expect(res.body.data.project.name).toBe("Renamed Project");
    });
  });

  describe("DELETE /api/v1/workspaces/:workspaceId/projects/:projectId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        "/api/v1/workspaces/ws-123/projects/proj-456",
      );
      expect(res.status).toBe(401);
    });

    it("deletes a project with a valid token", async () => {
      const res = await request(app)
        .delete("/api/v1/workspaces/ws-123/projects/proj-456")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
    });
  });
});
