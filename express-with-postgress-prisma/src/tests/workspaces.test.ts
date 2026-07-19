import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.ts";

const validAccessToken = jwt.sign(
  { userId: "abc123", email: "test@example.com" },
  process.env.JWT_ACCESS_SECRET!,
  { expiresIn: "15m" },
);

describe("Workspace routes", () => {
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
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ description: "No name provided" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when name is empty string", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ name: "" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when an unknown field is sent", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ name: "Marketing Team", owner: "someone-else" });

      expect(res.status).toBe(400);
    });

    it("creates a workspace with valid data", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({
          name: "Marketing Team",
          description: "For the marketing team",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.workspace).toBeDefined();
      expect(res.body.data.workspace.name).toBe("Marketing Team");
      expect(res.body.data.workspace.ownerId).toBe("abc123");
    });

    it("creates a workspace without a description", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${validAccessToken}`)
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

    it("returns a list of workspaces with a valid token", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.workspaces)).toBe(true);
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get("/api/v1/workspaces/ws-123");
      expect(res.status).toBe(401);
    });

    it("returns a workspace with a valid token", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces/ws-123")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workspace.id).toBe("ws-123");
    });
  });

  describe("PATCH /api/v1/workspaces/:workspaceId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123")
        .send({ name: "New Name" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when body is empty", async () => {
      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("updates name only", async () => {
      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ name: "Renamed Workspace" });

      expect(res.status).toBe(200);
      expect(res.body.data.workspace.name).toBe("Renamed Workspace");
    });

    it("updates description only", async () => {
      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ description: "Updated description" });

      expect(res.status).toBe(200);
      expect(res.body.data.workspace.description).toBe("Updated description");
    });
  });

  describe("DELETE /api/v1/workspaces/:workspaceId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).delete("/api/v1/workspaces/ws-123");
      expect(res.status).toBe(401);
    });

    it("deletes a workspace with a valid token", async () => {
      const res = await request(app)
        .delete("/api/v1/workspaces/ws-123")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
    });
  });
});
