import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import app from "../app.ts";
import { prisma } from "../config/db.ts";

const SIGNUP_EMAIL = "signup-test@example.com";
const SIGNUP_USERNAME = "signuptestuser";

const SIGNIN_EMAIL = "signin-test@example.com";
const SIGNIN_USERNAME = "signintestuser";
const SIGNIN_PASSWORD = "Password1!";

const REFRESH_EMAIL = "refresh-test@example.com";
const REFRESH_USERNAME = "refreshtestuser";

const SIGNOUT_EMAIL = "signout-test@example.com";
const SIGNOUT_USERNAME = "signouttestuser";

const ROLE_CHECK_EMAIL = "role-check@example.com";
const ROLE_CHECK_USERNAME = "rolecheckuser";

const CHANGE_PW_EMAIL = "change-pw-test@example.com";
const CHANGE_PW_USERNAME = "changepwtestuser";
const CHANGE_PW_CURRENT = "CurrentPassword1!";

const SESSION_REVOKE_EMAIL = "session-revoke-test@example.com";
const SESSION_REVOKE_USERNAME = "sessionrevoketest";
const SESSION_REVOKE_PASSWORD = "Password1!";

const ALL_EMAILS = [
  SIGNUP_EMAIL,
  SIGNIN_EMAIL,
  REFRESH_EMAIL,
  SIGNOUT_EMAIL,
  ROLE_CHECK_EMAIL,
  CHANGE_PW_EMAIL,
  SESSION_REVOKE_EMAIL,
];
const ALL_USERNAMES = [
  SIGNUP_USERNAME,
  SIGNIN_USERNAME,
  REFRESH_USERNAME,
  SIGNOUT_USERNAME,
  ROLE_CHECK_USERNAME,
  CHANGE_PW_USERNAME,
  SESSION_REVOKE_USERNAME,
];

const cleanup = () =>
  prisma.user.deleteMany({
    where: {
      OR: [{ email: { in: ALL_EMAILS } }, { username: { in: ALL_USERNAMES } }],
    },
  });

describe("Auth routes", () => {
  beforeAll(cleanup);

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  describe("POST /api/v1/auth/signup", () => {
    it("registers a user, sets refreshToken cookie, and creates a session", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send({
        fullName: "Signup Test",
        username: SIGNUP_USERNAME,
        email: SIGNUP_EMAIL,
        password: "Password1!",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();

      const cookie = res.headers["set-cookie"]?.[0];
      expect(cookie).toMatch(/refreshToken=/);

      const refreshToken = cookie!.split("refreshToken=")[1]!.split(";")[0]!;
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET!,
      ) as { tokenId: string };

      const session = await prisma.session.findUnique({
        where: { tokenId: decoded.tokenId },
      });
      expect(session).not.toBeNull();
    });

    it("returns the user's role in the response body", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send({
        fullName: "Role Body Check",
        username: "rolebodycheck",
        email: "role-body-check@example.com",
        password: "Password1!",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe("admin");

      await prisma.user.delete({
        where: { email: "role-body-check@example.com" },
      });
    });

    it("defaults a new user's role to admin", async () => {
      const res = await request(app).post("/api/v1/auth/signup").send({
        fullName: "Role Check",
        username: ROLE_CHECK_USERNAME,
        email: ROLE_CHECK_EMAIL,
        password: "Password1!",
      });

      expect(res.status).toBe(201);

      const dbUser = await prisma.user.findUnique({
        where: { email: ROLE_CHECK_EMAIL },
      });
      expect(dbUser?.role).toBe("admin");
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
          role: "admin",
          mustChangePassword: false,
        },
      });
    });

    it("returns mustChangePassword: true for a user signing in with a temp password", async () => {
      const tempPassword = "TempPassword1!";

      const tempPwUser = await prisma.user.create({
        data: {
          fullName: "Temp Password Signin User",
          username: "tempsigninuser",
          email: "temp-signin-check@example.com",
          password: await bcrypt.hash(tempPassword, 10),
          role: "user",
          mustChangePassword: true,
        },
      });

      const res = await request(app).post("/api/v1/auth/signin").send({
        email: tempPwUser.email,
        password: tempPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.user.mustChangePassword).toBe(true);

      await prisma.user.delete({ where: { id: tempPwUser.id } });
    });

    it("signs in, sets refreshToken cookie, creates a session, and returns role", async () => {
      const res = await request(app).post("/api/v1/auth/signin").send({
        email: SIGNIN_EMAIL,
        password: SIGNIN_PASSWORD,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.user.fullName).toBe("Signin Test");
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.role).toBe("admin");
      expect(res.body.data.user.mustChangePassword).toBe(false);

      const cookie = res.headers["set-cookie"]?.[0];
      expect(cookie).toMatch(/refreshToken=/);

      const refreshToken = cookie!.split("refreshToken=")[1]!.split(";")[0]!;
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET!,
      ) as { tokenId: string };

      const session = await prisma.session.findUnique({
        where: { tokenId: decoded.tokenId },
      });
      expect(session).not.toBeNull();
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
    let userId: string;

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          fullName: "Refresh Test",
          username: REFRESH_USERNAME,
          email: REFRESH_EMAIL,
          password: await bcrypt.hash("Password1!", 10),
          role: "admin",
          mustChangePassword: false,
        },
      });
      userId = user.id;
    });

    it("returns 401 with no refresh token cookie", async () => {
      const res = await request(app).post("/api/v1/auth/refresh");
      expect(res.status).toBe(401);
    });

    it("returns 401 with an expired refresh token", async () => {
      const expiredToken = jwt.sign(
        { userId, email: REFRESH_EMAIL, tokenId: crypto.randomUUID() },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: "-1s" },
      );

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=${expiredToken}`]);

      expect(res.status).toBe(401);
    });

    it("returns 401 when the session has been revoked (e.g. deleted from DB)", async () => {
      const tokenId = crypto.randomUUID();

      await prisma.session.create({
        data: {
          tokenId,
          userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.session.delete({ where: { tokenId } });

      const validSignatureToken = jwt.sign(
        { userId, email: REFRESH_EMAIL, tokenId },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: "7d" },
      );

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=${validSignatureToken}`]);

      expect(res.status).toBe(401);
    });

    it("returns a new access token when the session is valid", async () => {
      const tokenId = crypto.randomUUID();

      await prisma.session.create({
        data: {
          tokenId,
          userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const validToken = jwt.sign(
        { userId, email: REFRESH_EMAIL, tokenId },
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
    it("clears the refreshToken cookie and deletes the session", async () => {
      const signupRes = await request(app).post("/api/v1/auth/signup").send({
        fullName: "Signout Test",
        username: SIGNOUT_USERNAME,
        email: SIGNOUT_EMAIL,
        password: "Password1!",
      });

      const cookie = signupRes.headers["set-cookie"]?.[0]!;
      const refreshToken = cookie.split("refreshToken=")[1]!.split(";")[0]!;
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET!,
      ) as { tokenId: string };

      const res = await request(app)
        .post("/api/v1/auth/signout")
        .set("Cookie", [`refreshToken=${refreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=;/);

      const session = await prisma.session.findUnique({
        where: { tokenId: decoded.tokenId },
      });
      expect(session).toBeNull();
    });

    it("still clears the cookie even with no refresh token present", async () => {
      const res = await request(app).post("/api/v1/auth/signout");
      expect(res.status).toBe(200);
      expect(res.headers["set-cookie"]?.[0]).toMatch(/refreshToken=;/);
    });
  });

  describe("PATCH /api/v1/auth/change-password", () => {
    let changePwUserId: string;
    let changePwToken: string;

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          fullName: "Change Password Test",
          username: CHANGE_PW_USERNAME,
          email: CHANGE_PW_EMAIL,
          password: await bcrypt.hash(CHANGE_PW_CURRENT, 10),
          role: "admin",
          mustChangePassword: true, // mirrors the invited-member flow
        },
      });
      changePwUserId = user.id;

      changePwToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
        },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "15m" },
      );
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch("/api/v1/auth/change-password")
        .send({
          currentPassword: CHANGE_PW_CURRENT,
          newPassword: "NewPassword1!",
        });

      expect(res.status).toBe(401);
    });

    it("returns 400 when newPassword is weak", async () => {
      const res = await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${changePwToken}`)
        .send({ currentPassword: CHANGE_PW_CURRENT, newPassword: "weak" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when newPassword equals currentPassword", async () => {
      const res = await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${changePwToken}`)
        .send({
          currentPassword: CHANGE_PW_CURRENT,
          newPassword: CHANGE_PW_CURRENT,
        });

      expect(res.status).toBe(400);
    });

    it("returns 400 when currentPassword is missing", async () => {
      const res = await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${changePwToken}`)
        .send({ newPassword: "NewPassword1!" });

      expect(res.status).toBe(400);
    });

    it("returns 401 when currentPassword is incorrect", async () => {
      const res = await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${changePwToken}`)
        .send({
          currentPassword: "WrongPassword1!",
          newPassword: "NewPassword1!",
        });

      expect(res.status).toBe(401);
    });

    it("changes the password, clears mustChangePassword, and old/new credentials swap validity", async () => {
      const res = await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${changePwToken}`)
        .send({
          currentPassword: CHANGE_PW_CURRENT,
          newPassword: "NewPassword1!",
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");

      const dbUser = await prisma.user.findUnique({
        where: { id: changePwUserId },
      });
      expect(dbUser?.mustChangePassword).toBe(false);

      const oldPasswordSignin = await request(app)
        .post("/api/v1/auth/signin")
        .send({
          email: CHANGE_PW_EMAIL,
          password: CHANGE_PW_CURRENT,
        });
      expect(oldPasswordSignin.status).toBe(401);

      const newPasswordSignin = await request(app)
        .post("/api/v1/auth/signin")
        .send({
          email: CHANGE_PW_EMAIL,
          password: "NewPassword1!",
        });
      expect(newPasswordSignin.status).toBe(200);
    });
  });

  describe("Password change revokes other sessions", () => {
    beforeAll(async () => {
      await prisma.user.create({
        data: {
          fullName: "Session Revoke Test",
          username: SESSION_REVOKE_USERNAME,
          email: SESSION_REVOKE_EMAIL,
          password: await bcrypt.hash(SESSION_REVOKE_PASSWORD, 10),
          role: "admin",
          mustChangePassword: false,
        },
      });
    });

    it("keeps the current session valid but revokes other sessions after a password change", async () => {
      // Sign in twice — two separate sessions/devices
      const signinA = await request(app).post("/api/v1/auth/signin").send({
        email: SESSION_REVOKE_EMAIL,
        password: SESSION_REVOKE_PASSWORD,
      });
      const signinB = await request(app).post("/api/v1/auth/signin").send({
        email: SESSION_REVOKE_EMAIL,
        password: SESSION_REVOKE_PASSWORD,
      });

      const accessTokenA = signinA.body.data.accessToken;
      const refreshCookieA = signinA.headers["set-cookie"]?.[0]!;
      const refreshTokenA = refreshCookieA
        .split("refreshToken=")[1]!
        .split(";")[0]!;

      const refreshCookieB = signinB.headers["set-cookie"]?.[0]!;
      const refreshTokenB = refreshCookieB
        .split("refreshToken=")[1]!
        .split(";")[0]!;

      // Change password using session A's access token + refresh cookie
      const changeRes = await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${accessTokenA}`)
        .set("Cookie", [`refreshToken=${refreshTokenA}`])
        .send({
          currentPassword: SESSION_REVOKE_PASSWORD,
          newPassword: "NewPassword1!",
        });

      expect(changeRes.status).toBe(200);

      // Session A should still be able to refresh
      const refreshA = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=${refreshTokenA}`]);
      expect(refreshA.status).toBe(200);

      // Session B should have been revoked
      const refreshB = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=${refreshTokenB}`]);
      expect(refreshB.status).toBe(401);
    });
  });
});
