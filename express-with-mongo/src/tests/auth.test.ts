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

// Pulls just the refreshToken=... value out of a Set-Cookie header so it
// can be replayed manually in tests that don't use a persistent agent
const extractRefreshCookie = (
  setCookieHeader: string | string[] | undefined,
): string => {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];

  const cookie = cookies.find((c) => c.startsWith("refreshToken="));
  if (!cookie) {
    throw new Error("refreshToken cookie not found in response");
  }
  return cookie.split(";")[0]!;
};

describe("Auth routes", () => {
  describe("POST /api/v1/auth/signup", () => {
    it("registers a user with valid data and sets refreshToken cookie", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
    });

    it("rejects weak password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({ ...testUser, password: "weak" });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("fail");
    });

    it("rejects a duplicate email", async () => {
      await request(app).post("/api/v1/auth/signup").send(testUser);

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({ ...testUser, username: "differentusername" });

      expect(res.status).toBe(409);
    });

    it("rejects a duplicate username", async () => {
      await request(app).post("/api/v1/auth/signup").send(testUser);

      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({ ...testUser, email: "different@example.com" });

      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/v1/auth/signin", () => {
    it("signs in and sets refreshToken cookie", async () => {
      await request(app).post("/api/v1/auth/signup").send(testUser);

      const res = await request(app).post("/api/v1/auth/signin").send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
    });

    it("rejects when neither username nor email provided", async () => {
      const res = await request(app).post("/api/v1/auth/signin").send({
        password: testUser.password,
      });

      expect(res.status).toBe(400);
    });

    it("rejects a wrong password", async () => {
      await request(app).post("/api/v1/auth/signup").send(testUser);

      const res = await request(app).post("/api/v1/auth/signin").send({
        email: testUser.email,
        password: "WrongPassword1!",
      });

      expect(res.status).toBe(401);
    });

    it("rejects a nonexistent user", async () => {
      const res = await request(app).post("/api/v1/auth/signin").send({
        email: "nobody@example.com",
        password: testUser.password,
      });

      expect(res.status).toBe(401);
    });

    it("creates a separate session on each signin (multi-device)", async () => {
      await request(app).post("/api/v1/auth/signup").send(testUser);

      const login1 = await request(app).post("/api/v1/auth/signin").send({
        email: testUser.email,
        password: testUser.password,
      });
      const login2 = await request(app).post("/api/v1/auth/signin").send({
        email: testUser.email,
        password: testUser.password,
      });

      const cookie1 = extractRefreshCookie(login1.headers["set-cookie"]);
      const cookie2 = extractRefreshCookie(login2.headers["set-cookie"]);

      // Two independent sessions -> two different refresh tokens
      expect(cookie1).not.toBe(cookie2);

      // Both should still work independently, proving neither login
      // invalidated the other
      const refresh1 = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [cookie1!]);
      const refresh2 = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [cookie2!]);

      expect(refresh1.status).toBe(200);
      expect(refresh2.status).toBe(200);
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("returns 401 with no refresh token cookie", async () => {
      const res = await request(app).post("/api/v1/auth/refresh");
      expect(res.status).toBe(401);
    });

    it("returns 401 with a malformed/expired refresh token", async () => {
      const expiredToken = jwt.sign(
        {
          userId: "abc",
          email: "test@example.com",
          sessionId: "000000000000000000000000",
        },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: "-1s" }, // already expired
      );

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=${expiredToken}`]);

      expect(res.status).toBe(401);
    });

    it("returns 401 when the session no longer exists", async () => {
      // A validly-signed token, but its sessionId doesn't correspond to
      // any real Session document (never created, or already deleted)
      const orphanToken = jwt.sign(
        {
          userId: "000000000000000000000001",
          email: "test@example.com",
          sessionId: "000000000000000000000002",
        },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: "7d" },
      );

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=${orphanToken}`]);

      expect(res.status).toBe(401);
    });

    it("returns a new access token and rotates the refresh token", async () => {
      const signupRes = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      const originalCookie = extractRefreshCookie(
        signupRes.headers["set-cookie"],
      );

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [originalCookie!]);

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();

      const rotatedCookie = extractRefreshCookie(res.headers["set-cookie"]);
      expect(rotatedCookie).toBeDefined();
      expect(rotatedCookie).not.toBe(originalCookie);
    });

    it("rejects reusing a refresh token after it has been rotated", async () => {
      const signupRes = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      const originalCookie = extractRefreshCookie(
        signupRes.headers["set-cookie"],
      );

      // First refresh succeeds and rotates the session
      await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [originalCookie!]);

      // Replaying the now-dead original token should fail
      const reuseRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [originalCookie!]);

      expect(reuseRes.status).toBe(401);
    });
  });

  describe("POST /api/v1/auth/signout", () => {
    it("clears the refreshToken cookie", async () => {
      const res = await request(app).post("/api/v1/auth/signout");
      expect(res.status).toBe(200);
      expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=;/);
    });

    it("revokes the session so the refresh token no longer works", async () => {
      const signupRes = await request(app)
        .post("/api/v1/auth/signup")
        .send(testUser);

      const cookie = extractRefreshCookie(signupRes.headers["set-cookie"]);

      const signoutRes = await request(app)
        .post("/api/v1/auth/signout")
        .set("Cookie", [cookie!]);

      expect(signoutRes.status).toBe(200);

      const refreshRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [cookie!]);

      expect(refreshRes.status).toBe(401);
    });
  });
});
