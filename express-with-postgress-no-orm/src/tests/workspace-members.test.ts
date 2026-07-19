import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.ts";

const validAccessToken = jwt.sign(
  { userId: "abc123", email: "test@example.com" },
  process.env.JWT_ACCESS_SECRET!,
  { expiresIn: "15m" },
);

describe("Workspace member routes", () => {
  describe("POST /api/v1/workspaces/:workspaceId/members", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .send({ email: "member@example.com", role: "member" });

      expect(res.status).toBe(401);
    });

    it("returns 400 for an invalid role", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ email: "member@example.com", role: "owner" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid email", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ email: "not-an-email", role: "member" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when role is missing", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ email: "member@example.com" });

      expect(res.status).toBe(400);
    });

    it("adds a member with valid data", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ email: "member@example.com", role: "member" });

      expect(res.status).toBe(201);
      expect(res.body.data.member.email).toBe("member@example.com");
      expect(res.body.data.member.role).toBe("member");
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId/members", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get("/api/v1/workspaces/ws-123/members");
      expect(res.status).toBe(401);
    });

    it("returns the member list with a valid token", async () => {
      const res = await request(app)
        .get("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.members)).toBe(true);
    });
  });

  describe("PATCH /api/v1/workspaces/:workspaceId/members/:userId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123/members/user-456")
        .send({ role: "admin" });

      expect(res.status).toBe(401);
    });

    it("returns 400 for an invalid role", async () => {
      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123/members/user-456")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ role: "superadmin" });

      expect(res.status).toBe(400);
    });

    it("updates the role with a valid value", async () => {
      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123/members/user-456")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ role: "admin" });

      expect(res.status).toBe(200);
      expect(res.body.data.member.role).toBe("admin");
    });
  });

  describe("DELETE /api/v1/workspaces/:workspaceId/members/:userId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        "/api/v1/workspaces/ws-123/members/user-456",
      );
      expect(res.status).toBe(401);
    });

    it("removes a member with a valid token", async () => {
      const res = await request(app)
        .delete("/api/v1/workspaces/ws-123/members/user-456")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
    });
  });
});
