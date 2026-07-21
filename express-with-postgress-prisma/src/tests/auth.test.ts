import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.ts";
import { prisma } from "../config/db.ts";

const TEST_EMAIL = "test@example.com";
const TEST_USERNAME = "testuser";

describe("Auth routes", () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { OR: [{ email: TEST_EMAIL }, { username: TEST_USERNAME }] },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { OR: [{ email: TEST_EMAIL }, { username: TEST_USERNAME }] },
    });
    await prisma.$disconnect();
  });

  describe("POST /api/v1/auth/signup", () => {
    it("registers a user with valid data and sets refreshToken cookie", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send({
        fullName: "Test User",
        username: TEST_USERNAME,
        email: TEST_EMAIL,
        password: "Password1!",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
    });

    it("rejects weak password", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send({
        fullName: "Test User",
        username: TEST_USERNAME,
        email: TEST_EMAIL,
        password: "weak",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("fail");
    });

    it("rejects duplicate email/username with 409", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send({
        fullName: "Test User",
        username: TEST_USERNAME,
        email: TEST_EMAIL,
        password: "Password1!",
      });

      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/v1/auth/signin", () => {
    it("signs in and sets refreshToken cookie", async () => {
      const res = await request(app).post("/api/v1/auth/signin").send({
        email: TEST_EMAIL,
        password: "Password1!",
      });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
    });

    it("rejects wrong password with 401", async () => {
      const res = await request(app).post("/api/v1/auth/signin").send({
        email: TEST_EMAIL,
        password: "WrongPassword1!",
      });

      expect(res.status).toBe(401);
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
        { userId: "abc", email: TEST_EMAIL },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: "-1s" },
      );

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=${expiredToken}`]);

      expect(res.status).toBe(401);
    });

    it("returns a new access token with a valid refresh token", async () => {
      const validToken = jwt.sign(
        { userId: "abc", email: TEST_EMAIL },
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
