import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import app from "../app.ts";
import { prisma } from "../config/db.ts";

const PRIMARY_EMAIL = "users-primary@example.com";
const PRIMARY_USERNAME = "usersprimary";

const TAKEN_EMAIL = "users-taken@example.com";
const TAKEN_USERNAME = "userstaken";

const ADMIN_EMAIL = "users-admin@example.com";
const ADMIN_USERNAME = "usersadmin";

let primaryUserId: string;
let validAccessToken: string;
let adminAccessToken: string;

const cleanup = () =>
  prisma.user.deleteMany({
    where: {
      OR: [
        { email: { in: [PRIMARY_EMAIL, TAKEN_EMAIL, ADMIN_EMAIL] } },
        {
          username: { in: [PRIMARY_USERNAME, TAKEN_USERNAME, ADMIN_USERNAME] },
        },
      ],
    },
  });

describe("User routes", () => {
  beforeAll(async () => {
    await cleanup();

    const primaryUser = await prisma.user.create({
      data: {
        fullName: "Primary User",
        username: PRIMARY_USERNAME,
        email: PRIMARY_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "user",
        mustChangePassword: false,
      },
    });
    primaryUserId = primaryUser.id;

    await prisma.user.create({
      data: {
        fullName: "Taken Username User",
        username: TAKEN_USERNAME,
        email: TAKEN_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "user",
        mustChangePassword: false,
      },
    });

    const adminUser = await prisma.user.create({
      data: {
        fullName: "Admin User",
        username: ADMIN_USERNAME,
        email: ADMIN_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });

    validAccessToken = jwt.sign(
      {
        userId: primaryUser.id,
        email: primaryUser.email,
        username: primaryUser.username,
        fullName: primaryUser.fullName,
        role: primaryUser.role,
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "15m" },
    );

    adminAccessToken = jwt.sign(
      {
        userId: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        fullName: adminUser.fullName,
        role: adminUser.role,
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "15m" },
    );
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

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
        { userId: primaryUserId, email: PRIMARY_EMAIL },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "-1s" },
      );

      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it("returns 404 when the token's user no longer exists in the DB", async () => {
      const staleToken = jwt.sign(
        { userId: crypto.randomUUID(), email: "ghost@example.com" },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "15m" },
      );

      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${staleToken}`);

      expect(res.status).toBe(404);
    });

    it("returns mustChangePassword: true for a user who hasn't reset their temp password", async () => {
      const tempPwUser = await prisma.user.create({
        data: {
          fullName: "Temp Password User",
          username: "tempuserpwcheck",
          email: "temp-pw-check@example.com",
          password: await bcrypt.hash("Password1!", 10),
          role: "user",
          mustChangePassword: true,
        },
      });

      const token = jwt.sign(
        {
          userId: tempPwUser.id,
          email: tempPwUser.email,
          username: tempPwUser.username,
          fullName: tempPwUser.fullName,
          role: tempPwUser.role,
        },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "15m" },
      );

      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.mustChangePassword).toBe(true);

      await prisma.user.delete({ where: { id: tempPwUser.id } });
    });

    it("returns the real user profile from the DB, including role, with a valid access token", async () => {
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(primaryUserId);
      expect(res.body.data.user.username).toBe(PRIMARY_USERNAME);
      expect(res.body.data.user.email).toBe(PRIMARY_EMAIL);
      expect(res.body.data.user.role).toBe("user");
      expect(res.body.data.user.mustChangePassword).toBe(false);
      expect(res.body.data.user.password).toBeUndefined();
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
        .send({ email: "new@example.com" });

      expect(res.status).toBe(400);
    });

    it("rejects a username shorter than 3 characters", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ username: "ab" });

      expect(res.status).toBe(400);
    });

    it("returns 409 when the username is already taken by another user", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ username: TAKEN_USERNAME });

      expect(res.status).toBe(409);
    });

    it("updates fullName only, persisted in the DB, and still returns role", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ fullName: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.data.user.fullName).toBe("Updated Name");
      expect(res.body.data.user.role).toBe("user");

      const dbUser = await prisma.user.findUnique({
        where: { id: primaryUserId },
      });
      expect(dbUser?.fullName).toBe("Updated Name");
    });

    it("updates username only, persisted in the DB", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ username: "primaryrenamed" });

      expect(res.status).toBe(200);
      expect(res.body.data.user.username).toBe("primaryrenamed");

      const dbUser = await prisma.user.findUnique({
        where: { id: primaryUserId },
      });
      expect(dbUser?.username).toBe("primaryrenamed");
    });
  });

  describe("GET /api/v1/users (admin only)", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get("/api/v1/users");
      expect(res.status).toBe(401);
    });

    it("returns 403 for a non-admin user", async () => {
      const res = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(403);
    });

    it("returns all users for an admin, excluding passwords", async () => {
      const res = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${adminAccessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(3);

      const emails = res.body.data.users.map((u: { email: string }) => u.email);
      expect(emails).toEqual(
        expect.arrayContaining([PRIMARY_EMAIL, TAKEN_EMAIL, ADMIN_EMAIL]),
      );

      res.body.data.users.forEach((user: Record<string, unknown>) => {
        expect(user.password).toBeUndefined();
        expect(user.role).toBeDefined();
      });
    });
  });
});
