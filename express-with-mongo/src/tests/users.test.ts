import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.ts";

const testUser = {
  fullName: "Test User",
  username: "testuser",
  email: "test@example.com",
  password: "Password1!",
};

const otherUser = {
  fullName: "Other User",
  username: "otheruser",
  email: "other@example.com",
  password: "Password1!",
};

const signupAndGetToken = async (
  user: typeof testUser = testUser,
): Promise<string> => {
  const res = await request(app).post("/api/v1/auth/signup").send(user);
  return res.body.data.accessToken;
};

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
        {
          userId: "000000000000000000000001",
          email: "test@example.com",
          fullName: "Test User",
          username: "testuser",
          role: "admin",
        },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "-1s" },
      );

      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it("returns 404 when the token's user no longer exists in the DB", async () => {
      const orphanToken = jwt.sign(
        {
          userId: "000000000000000000000002",
          email: "ghost@example.com",
          fullName: "Ghost User",
          username: "ghostuser",
          role: "admin",
        },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "15m" },
      );

      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${orphanToken}`);

      expect(res.status).toBe(404);
    });

    it("returns the real user profile including role from the DB", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.fullName).toBe(testUser.fullName);
      expect(res.body.data.user.username).toBe(testUser.username);
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.role).toBe("admin");
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
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 400 when an unknown field is sent", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "new@example.com" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when attempting to patch role (not an editable field)", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ role: "user" });

      // userSchema is .strict(), so "role" is an unrecognized field
      expect(res.status).toBe(400);
    });

    it("updates fullName only and persists it to the DB", async () => {
      const accessToken = await signupAndGetToken();

      const patchRes = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ fullName: "Updated Name" });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.user.fullName).toBe("Updated Name");

      const getRes = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(getRes.body.data.user.fullName).toBe("Updated Name");
    });

    it("updates username only", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ username: "newusername" });

      expect(res.status).toBe(200);
      expect(res.body.data.user.username).toBe("newusername");
    });

    it("rejects a username shorter than 3 characters", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ username: "ab" });

      expect(res.status).toBe(400);
    });

    it("returns 409 when patching to a username that's already taken", async () => {
      await request(app).post("/api/v1/auth/signup").send({
        fullName: "Other User",
        username: "takenname",
        email: "taken@example.com",
        password: "Password1!",
      });

      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ username: "takenname" });

      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/v1/users", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get("/api/v1/users");
      expect(res.status).toBe(401);
    });

    it("returns 403 when the requester is not an admin", async () => {
      // Every signup currently defaults to admin, so we hand-craft a
      // token with role "user" to simulate a non-admin caller once
      // that role actually becomes assignable in the future
      const nonAdminToken = jwt.sign(
        {
          userId: "000000000000000000000003",
          email: testUser.email,
          fullName: testUser.fullName,
          username: testUser.username,
          role: "user",
        },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "15m" },
      );

      const res = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${nonAdminToken}`);

      expect(res.status).toBe(403);
    });

    it("returns the list of other users for an admin, excluding the requesting admin", async () => {
      const adminToken = await signupAndGetToken(); // Creates testUser (the requesting admin)
      await signupAndGetToken(otherUser); // Creates otherUser

      const res = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Length is 1 because testUser (admin) is excluded from the list
      expect(res.body.data.users).toHaveLength(1);

      // Verify the returned user is indeed otherUser and not testUser
      expect(res.body.data.users[0].username).toBe(otherUser.username);
      expect(res.body.data.users[0].role).toBe("admin");
    });
  });
});
