import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import app from "../app.ts";
import { prisma } from "../config/db.ts";

const SIGNUP_EMAIL = "signup-test@example.com";
const SIGNUP_USERNAME = "signuptestuser";

const SIGNIN_EMAIL = "signin-test@example.com";
const SIGNIN_USERNAME = "signintestuser";
const SIGNIN_PASSWORD = "Password1!";

describe("Auth routes", () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: SIGNUP_EMAIL },
          { username: SIGNUP_USERNAME },
          { email: SIGNIN_EMAIL },
          { username: SIGNIN_USERNAME },
        ],
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: SIGNUP_EMAIL },
          { username: SIGNUP_USERNAME },
          { email: SIGNIN_EMAIL },
          { username: SIGNIN_USERNAME },
        ],
      },
    });
    await prisma.$disconnect();
  });

  describe("POST /api/v1/auth/signup", () => {
    it("registers a user with valid data and sets refreshToken cookie", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send({
        fullName: "Signup Test",
        username: SIGNUP_USERNAME,
        email: SIGNUP_EMAIL,
        password: "Password1!",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
    });

    it("rejects weak password", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send({
        fullName: "Weak Pw",
        username: "weakpwuser",
        email: "weakpw@example.com",
        password: "weak",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("fail");
    });

    it("rejects duplicate email/username with 409", async () => {
      // reuses the user created in the first test above
      const res = await request(app).post("/api/v1/auth/signup").send({
        fullName: "Signup Test",
        username: SIGNUP_USERNAME,
        email: SIGNUP_EMAIL,
        password: "Password1!",
      });

      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/v1/auth/signin", () => {
    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash(SIGNIN_PASSWORD, 10);
      await prisma.user.create({
        data: {
          fullName: "Signin Test",
          username: SIGNIN_USERNAME,
          email: SIGNIN_EMAIL,
          password: hashedPassword,
          role: "user",
          mustChangePassword: false,
        },
      });
    });

    it("signs in and sets refreshToken cookie", async () => {
      const res = await request(app).post("/api/v1/auth/signin").send({
        email: SIGNIN_EMAIL,
        password: SIGNIN_PASSWORD,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
    });

    it("rejects wrong password with 401", async () => {
      const res = await request(app).post("/api/v1/auth/signin").send({
        email: SIGNIN_EMAIL,
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
        { userId: "abc", email: "test@example.com" },
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
