import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.ts";

describe("Auth routes", () => {
  describe("POST /api/v1/auth/signup", () => {
    it("registers a user with valid data and sets refreshToken cookie", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send({
        fullName: "Test User",
        username: "testuser",
        email: "test@example.com",
        password: "Password1!",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
    });

    it("rejects weak password", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send({
        fullName: "Test User",
        username: "testuser",
        email: "test@example.com",
        password: "weak",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("fail");
    });
  });

  describe("POST /api/v1/auth/signin", () => {
    it("signs in and sets refreshToken cookie", async () => {
      const res = await request(app).post("/api/v1/auth/signin").send({
        email: "test@example.com",
        password: "Password1!",
      });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
    });

    it("rejects when neither username nor email provided", async () => {
      const res = await request(app).post("/api/v1/auth/signin").send({
        password: "Password1!",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("returns 401 with no refresh token cookie", async () => {
      const res = await request(app).post("/api/v1/auth/refresh");
      expect(res.status).toBe(401);
    });

    it("returns 401 with an expired refresh token", async () => {
      const expiredToken = jwt.sign(
        { userId: "abc", email: "test@example.com" },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: "-1s" }, // already expired
      );

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=${expiredToken}`]);

      expect(res.status).toBe(401);
    });

    it("returns a new access token with a valid refresh token", async () => {
      const validToken = jwt.sign(
        { userId: "abc", email: "test@example.com" },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: "7d" },
      );

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=${validToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    });
  });

  describe("POST /api/v1/auth/signout", () => {
    it("clears the refreshToken cookie", async () => {
      const res = await request(app).post("/api/v1/auth/signout");
      expect(res.status).toBe(200);
      expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=;/);
    });
  });
});
