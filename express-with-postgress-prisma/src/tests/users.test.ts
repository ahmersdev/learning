import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import app from "../app.ts";
import { prisma } from "../config/db.ts";

const PRIMARY_EMAIL = "users-primary@example.com";
const PRIMARY_USERNAME = "usersprimary";

const TAKEN_EMAIL = "users-taken@example.com";
const TAKEN_USERNAME = "userstaken";

let primaryUserId: string;
let validAccessToken: string;

const cleanup = () =>
  prisma.user.deleteMany({
    where: {
      OR: [
        { email: { in: [PRIMARY_EMAIL, TAKEN_EMAIL] } },
        { username: { in: [PRIMARY_USERNAME, TAKEN_USERNAME] } },
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

    it("returns the real user profile from the DB with a valid access token", async () => {
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(primaryUserId);
      expect(res.body.data.user.username).toBe(PRIMARY_USERNAME);
      expect(res.body.data.user.email).toBe(PRIMARY_EMAIL);
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

    it("updates fullName only, persisted in the DB", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .send({ fullName: "Updated Name" });

      expect(res.status).toBe(200);
      expect(res.body.data.user.fullName).toBe("Updated Name");

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
});
