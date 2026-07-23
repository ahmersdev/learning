import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.ts";

const validAccessToken = jwt.sign(
  { userId: "abc123", email: "test@example.com" },
  process.env.JWT_ACCESS_SECRET!,
  { expiresIn: "15m" },
);

describe("User routes", () => {
  describe("GET /api/v1/users/me", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get("/api/v1/users/me");
      expect(res.status).toBe(401);
    });

    it("returns 401 with an invalid access token", async () => {
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", "Bearer not-a-real-token");

      expect(res.status).toBe(401);
    });

    it("returns 401 with an expired access token", async () => {
      const expiredToken = jwt.sign(
        { userId: "abc123", email: "test@example.com" },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "-1s" },
      );

      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it("returns the user profile with a valid access token", async () => {
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.id).toBe("abc123");
    });
  });

  describe("PATCH /api/v1/users/me", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me")
        .send({ fullName: "New Name" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when body is empty", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 400 when an unknown field is sent", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ email: "new@example.com" }); // not allowed by userSchema (.strict())

      expect(res.status).toBe(400);
    });

    it("updates fullName only", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ fullName: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.data.user.fullName).toBe("Updated Name");
    });

    it("updates username only", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ username: "newusername" });

      expect(res.status).toBe(200);
      expect(res.body.data.user.username).toBe("newusername");
    });

    it("rejects a username shorter than 3 characters", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ username: "ab" });

      expect(res.status).toBe(400);
    });
  });
});
