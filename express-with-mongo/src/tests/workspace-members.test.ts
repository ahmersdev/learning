import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import app from "../app.ts";

const adminUser = {
  fullName: "Admin User",
  username: "adminuser",
  email: "admin@example.com",
  password: "Password1!",
};

const outsiderUser = {
  fullName: "Outsider User",
  username: "outsideruser",
  email: "outsider@example.com",
  password: "Password1!",
};

const signupAndGetToken = async (
  user: typeof adminUser = adminUser,
): Promise<string> => {
  const res = await request(app).post("/api/v1/auth/signup").send(user);
  return res.body.data.accessToken;
};

// Signs up a fresh admin and creates a real workspace, returning both the
// admin's token and the workspace's real ID — every member route now does
// a genuine DB lookup via getRequesterRoleService, so a fake "ws-123"
// string will correctly 404 rather than being a usable stand-in
const createWorkspaceAsAdmin = async (): Promise<{
  accessToken: string;
  workspaceId: string;
}> => {
  const accessToken = await signupAndGetToken();

  const res = await request(app)
    .post("/api/v1/workspaces")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ name: "Test Workspace" });

  return { accessToken, workspaceId: res.body.data.workspace.id };
};

describe("Workspace member routes", () => {
  describe("POST /api/v1/workspaces/:workspaceId/members", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces/000000000000000000000000/members")
        .send({ email: "member@example.com", role: "member" });

      expect(res.status).toBe(401);
    });

    it("returns 404 when the workspace doesn't exist", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/workspaces/000000000000000000000000/members")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "member@example.com", role: "member" });

      expect(res.status).toBe(404);
    });

    it("returns 404 when the requester isn't a member of the workspace", async () => {
      const { workspaceId } = await createWorkspaceAsAdmin();
      const outsiderToken = await signupAndGetToken(outsiderUser);

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .send({ email: "member@example.com", role: "member" });

      expect(res.status).toBe(404);
    });

    it("returns 400 for an invalid role", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "member@example.com", role: "owner" });

      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid email", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "not-an-email", role: "member" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when role is missing", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "member@example.com" });

      expect(res.status).toBe(400);
    });

    it("provisions a brand-new account with a temporary password for an unknown email", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
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
    });

    it("does not return a temporaryPassword when the email already belongs to an existing user", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      await request(app).post("/api/v1/auth/signup").send({
        fullName: "Existing User",
        username: "existinguser",
        email: "existing@example.com",
        password: "Password1!",
      });

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "existing@example.com", role: "member" });

      expect(res.status).toBe(201);
      expect(res.body.data.temporaryPassword).toBeUndefined();
    });

    it("does not create a second membership row when re-adding the same email", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "dupe2@example.com", role: "member" });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "dupe2@example.com", role: "admin" });

      const listRes = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`);

      // admin (creator) + dupe2 = 2, not 3
      expect(listRes.body.data.members).toHaveLength(2);
    });

    it("returns 409 when adding a user who is already a member", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "dupe@example.com", role: "member" });

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "dupe@example.com", role: "admin" });

      expect(res.status).toBe(409);
    });

    it("returns 403 when a non-admin member tries to add someone", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const addRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "regularmember@example.com", role: "member" });

      const memberSigninRes = await request(app)
        .post("/api/v1/auth/signin")
        .send({
          email: "regularmember@example.com",
          password: addRes.body.data.temporaryPassword,
        });

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${memberSigninRes.body.data.accessToken}`)
        .send({ email: "another@example.com", role: "member" });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId/members", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get(
        "/api/v1/workspaces/000000000000000000000000/members",
      );
      expect(res.status).toBe(401);
    });

    it("returns 404 when the requester isn't a member", async () => {
      const { workspaceId } = await createWorkspaceAsAdmin();
      const outsiderToken = await signupAndGetToken(outsiderUser);

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });

    it("includes the workspace creator as an admin member", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.members).toHaveLength(1);
      expect(res.body.data.members[0].role).toBe("admin");
      expect(res.body.data.members[0].username).toBe(adminUser.username);
    });

    it("lists all members after more are added", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "member1@example.com", role: "member" });

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "member2@example.com", role: "member" });

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.members).toHaveLength(3); // admin + 2 members
    });
  });

  describe("PATCH /api/v1/workspaces/:workspaceId/members/:userId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch(
          "/api/v1/workspaces/000000000000000000000000/members/000000000000000000000000",
        )
        .send({ role: "admin" });

      expect(res.status).toBe(401);
    });

    it("returns 400 for an invalid role", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const addRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "member@example.com", role: "member" });

      const res = await request(app)
        .patch(
          `/api/v1/workspaces/${workspaceId}/members/${addRes.body.data.member.userId}`,
        )
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ role: "superadmin" });

      expect(res.status).toBe(400);
    });

    it("updates the role with a valid value", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const addRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "member@example.com", role: "member" });

      const targetUserId = addRes.body.data.member.userId;

      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/members/${targetUserId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ role: "admin" });

      expect(res.status).toBe(200);
      expect(res.body.data.member.role).toBe("admin");
    });

    it("returns 404 for a nonexistent member", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const res = await request(app)
        .patch(
          `/api/v1/workspaces/${workspaceId}/members/000000000000000000000000`,
        )
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ role: "admin" });

      expect(res.status).toBe(404);
    });

    it("returns 403 when an admin tries to change their own role", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const meRes = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`);

      const res = await request(app)
        .patch(
          `/api/v1/workspaces/${workspaceId}/members/${meRes.body.data.user.id}`,
        )
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ role: "member" });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/v1/workspaces/:workspaceId/members/:userId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        "/api/v1/workspaces/000000000000000000000000/members/000000000000000000000000",
      );
      expect(res.status).toBe(401);
    });

    it("removes a member with a valid token", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const addRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "member@example.com", role: "member" });

      const targetUserId = addRes.body.data.member.userId;

      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}/members/${targetUserId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);

      const listRes = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(listRes.body.data.members).toHaveLength(1); // only the admin remains
    });

    it("returns 404 for a nonexistent member", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const res = await request(app)
        .delete(
          `/api/v1/workspaces/${workspaceId}/members/000000000000000000000000`,
        )
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 403 when an admin tries to remove themselves", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const meRes = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${accessToken}`);

      const res = await request(app)
        .delete(
          `/api/v1/workspaces/${workspaceId}/members/${meRes.body.data.user.id}`,
        )
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId/members (mustChangePassword visibility)", () => {
    it("shows mustChangePassword true for a newly provisioned member", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "pending@example.com", role: "member" });

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`);

      const member = res.body.data.members.find(
        (m: { email: string }) => m.email === "pending@example.com",
      );
      expect(member.mustChangePassword).toBe(true);
      expect(member.password).toBeUndefined();
    });

    it("shows mustChangePassword false once a member changes their own password", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const addRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "settled@example.com", role: "member" });

      const signinRes = await request(app).post("/api/v1/auth/signin").send({
        email: "settled@example.com",
        password: addRes.body.data.temporaryPassword,
      });

      await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${signinRes.body.data.accessToken}`)
        .send({
          currentPassword: addRes.body.data.temporaryPassword,
          newPassword: "MyOwnPassword1!",
        });

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`);

      const member = res.body.data.members.find(
        (m: { email: string }) => m.email === "settled@example.com",
      );
      expect(member.mustChangePassword).toBe(false);
    });
  });

  describe("POST /api/v1/workspaces/:workspaceId/members/:userId/reset-password", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).post(
        "/api/v1/workspaces/000000000000000000000000/members/000000000000000000000000/reset-password",
      );
      expect(res.status).toBe(401);
    });

    it("returns 404 for a nonexistent member", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const res = await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/members/000000000000000000000000/reset-password`,
        )
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });

    it("generates a new working temporary password for a pending member", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const addRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "lostinvite@example.com", role: "member" });

      const resetRes = await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/members/${addRes.body.data.member.userId}/reset-password`,
        )
        .set("Authorization", `Bearer ${accessToken}`);

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.data.temporaryPassword).toBeDefined();
      // The reset password is different from the original one
      expect(resetRes.body.data.temporaryPassword).not.toBe(
        addRes.body.data.temporaryPassword,
      );

      // Old temp password no longer works
      const oldSignin = await request(app).post("/api/v1/auth/signin").send({
        email: "lostinvite@example.com",
        password: addRes.body.data.temporaryPassword,
      });
      expect(oldSignin.status).toBe(401);

      // New temp password works
      const newSignin = await request(app).post("/api/v1/auth/signin").send({
        email: "lostinvite@example.com",
        password: resetRes.body.data.temporaryPassword,
      });
      expect(newSignin.status).toBe(200);
    });

    it("returns 403 when the member has already set their own password", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const addRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "settledmember@example.com", role: "member" });

      const signinRes = await request(app).post("/api/v1/auth/signin").send({
        email: "settledmember@example.com",
        password: addRes.body.data.temporaryPassword,
      });

      await request(app)
        .patch("/api/v1/auth/change-password")
        .set("Authorization", `Bearer ${signinRes.body.data.accessToken}`)
        .send({
          currentPassword: addRes.body.data.temporaryPassword,
          newPassword: "MyOwnPassword1!",
        });

      const res = await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/members/${addRes.body.data.member.userId}/reset-password`,
        )
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });

    it("returns 403 for a non-admin member", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const addRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "regularmember@example.com", role: "member" });

      const memberSigninRes = await request(app)
        .post("/api/v1/auth/signin")
        .send({
          email: "regularmember@example.com",
          password: addRes.body.data.temporaryPassword,
        });

      const res = await request(app)
        .post(
          `/api/v1/workspaces/${workspaceId}/members/${addRes.body.data.member.userId}/reset-password`,
        )
        .set("Authorization", `Bearer ${memberSigninRes.body.data.accessToken}`)
        .send();

      expect(res.status).toBe(403);
    });
  });
});
