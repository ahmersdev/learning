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

// Signs up a fresh user and returns their real access token, so tests
// exercise the actual DB-backed flow instead of a hand-crafted JWT
const signupAndGetToken = async (): Promise<string> => {
  const res = await request(app).post("/api/v1/auth/signup").send(testUser);
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
      // Validly-signed token, but no matching User document was ever created
      const orphanToken = jwt.sign(
        {
          userId: "000000000000000000000002",
          email: "ghost@example.com",
          fullName: "Ghost User",
          username: "ghostuser",
        },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "15m" },
      );

      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${orphanToken}`);

      expect(res.status).toBe(404);
    });

    it("returns the real user profile from the DB with a valid access token", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.fullName).toBe(testUser.fullName);
      expect(res.body.data.user.username).toBe(testUser.username);
      expect(res.body.data.user.email).toBe(testUser.email);
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
        .send({ email: "new@example.com" }); // not allowed by userSchema (.strict())

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

      // Confirm the update actually persisted, not just echoed back
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
      // A second, distinct user already owns "takenname"
      await request(app).post("/api/v1/auth/signup").send({
        fullName: "Other User",
        username: "takenname",
        email: "other@example.com",
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
});
