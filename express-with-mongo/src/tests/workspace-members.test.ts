import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import app from "../app.ts";

const adminUser = {
  fullName: "Admin User",
  username: "adminuser",
  email: "admin@example.com",
  password: "Password1!",
};

const signupAndGetToken = async (
  user: typeof adminUser = adminUser,
): Promise<string> => {
  const res = await request(app).post("/api/v1/auth/signup").send(user);
  return res.body.data.accessToken;
};

describe("Workspace member routes", () => {
  describe("POST /api/v1/workspaces/:workspaceId/members", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .send({ email: "member@example.com", role: "member" });

      expect(res.status).toBe(401);
    });

    it("returns 400 for an invalid role", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "member@example.com", role: "owner" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid email", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "not-an-email", role: "member" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when role is missing", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "member@example.com" });

      expect(res.status).toBe(400);
    });

    it("provisions a brand-new account with a temporary password for an unknown email", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          fullName: "New Member",
          email: "newmember@example.com",
          role: "member",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.member.email).toBe("newmember@example.com");
      expect(res.body.data.member.role).toBe("member");
      expect(res.body.data.member.username).toBeDefined();
      expect(res.body.data.temporaryPassword).toBeDefined();
      expect(typeof res.body.data.temporaryPassword).toBe("string");
    });

    it("derives a username from the email local part", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "janedoe@example.com", role: "member" });

      expect(res.status).toBe(201);

      // Confirm the provisioned account can actually sign in with a
      // username matching the email's local part
      const signinRes = await request(app).post("/api/v1/auth/signin").send({
        username: "janedoe",
        password: res.body.data.temporaryPassword,
      });

      expect(signinRes.status).toBe(200);
    });

    it("assigns global role 'user' (not admin) to a newly provisioned member", async () => {
      const accessToken = await signupAndGetToken();

      const postRes = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "regularmember@example.com", role: "admin" });

      const signinRes = await request(app).post("/api/v1/auth/signin").send({
        email: "regularmember@example.com",
        password: postRes.body.data.temporaryPassword,
      });

      // Note: "admin" above is the workspace-scoped role, unrelated to
      // the platform-wide User.role, which should still default to "user"
      expect(signinRes.body.data.user.role).toBe("user");
    });

    it("sets mustChangePassword true for a newly provisioned member", async () => {
      const accessToken = await signupAndGetToken();

      const postRes = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "flagcheck@example.com", role: "member" });

      const signinRes = await request(app).post("/api/v1/auth/signin").send({
        email: "flagcheck@example.com",
        password: postRes.body.data.temporaryPassword,
      });

      const meRes = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${signinRes.body.data.accessToken}`);

      expect(meRes.body.data.user.mustChangePassword).toBe(true);
    });

    it("does not return a temporaryPassword when the email already belongs to an existing user", async () => {
      const accessToken = await signupAndGetToken();

      // A real, already-existing account
      await request(app).post("/api/v1/auth/signup").send({
        fullName: "Existing User",
        username: "existinguser",
        email: "existing@example.com",
        password: "Password1!",
      });

      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "existing@example.com", role: "member" });

      expect(res.status).toBe(201);
      expect(res.body.data.temporaryPassword).toBeUndefined();
    });

    it("handles a username collision by generating a unique alternative", async () => {
      const accessToken = await signupAndGetToken();

      // Occupies the username "collide" via a normal signup
      await request(app).post("/api/v1/auth/signup").send({
        fullName: "Original Collide",
        username: "collide",
        email: "collide@somewhereelse.com",
        password: "Password1!",
      });

      // A different email whose local part also happens to be "collide"
      const res = await request(app)
        .post("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "collide@example.com", role: "member" });

      expect(res.status).toBe(201);

      const signinRes = await request(app).post("/api/v1/auth/signin").send({
        email: "collide@example.com",
        password: res.body.data.temporaryPassword,
      });

      // Login succeeds, proving a distinct account (and thus a distinct,
      // non-colliding username) was actually created under the hood
      expect(signinRes.status).toBe(200);
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId/members", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get("/api/v1/workspaces/ws-123/members");
      expect(res.status).toBe(401);
    });

    it("returns the member list with a valid token", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .get("/api/v1/workspaces/ws-123/members")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.members)).toBe(true);
    });
  });

  describe("PATCH /api/v1/workspaces/:workspaceId/members/:userId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123/members/user-456")
        .send({ role: "admin" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when body is empty", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123/members/user-456")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid role", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123/members/user-456")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ role: "superadmin" });

      expect(res.status).toBe(400);
    });

    it("updates the role with a valid value", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .patch("/api/v1/workspaces/ws-123/members/user-456")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ role: "admin" });

      expect(res.status).toBe(200);
      expect(res.body.data.member.role).toBe("admin");
    });
  });

  describe("DELETE /api/v1/workspaces/:workspaceId/members/:userId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        "/api/v1/workspaces/ws-123/members/user-456",
      );
      expect(res.status).toBe(401);
    });

    it("removes a member with a valid token", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .delete("/api/v1/workspaces/ws-123/members/user-456")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
    });
  });
});
