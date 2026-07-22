import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import app from "../app.ts";
import { prisma } from "../config/db.ts";

const OWNER_EMAIL = "wsmembers-owner@example.com";
const OWNER_USERNAME = "wsmembersowner";

const EXISTING_INVITE_EMAIL = "wsmembers-existing@example.com";
const EXISTING_INVITE_USERNAME = "wsmembersexisting";

const OUTSIDER_EMAIL = "wsmembers-outsider@example.com";
const OUTSIDER_USERNAME = "wsmembersoutsider";

const NEW_INVITE_EMAIL = "wsmembers-newinvite@example.com";

const ALL_EMAILS = [
  OWNER_EMAIL,
  EXISTING_INVITE_EMAIL,
  OUTSIDER_EMAIL,
  NEW_INVITE_EMAIL,
];
const ALL_USERNAMES = [
  OWNER_USERNAME,
  EXISTING_INVITE_USERNAME,
  OUTSIDER_USERNAME,
];

let ownerToken: string;
let ownerId: string;
let workspaceId: string;
let existingInviteUserId: string;
let outsiderToken: string;

const cleanup = () =>
  prisma.user.deleteMany({
    where: {
      OR: [{ email: { in: ALL_EMAILS } }, { username: { in: ALL_USERNAMES } }],
    },
  });

const signToken = (user: {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: string;
}) =>
  jwt.sign(
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

describe("Workspace Member routes", () => {
  beforeAll(async () => {
    await cleanup();

    const owner = await prisma.user.create({
      data: {
        fullName: "Workspace Members Owner",
        username: OWNER_USERNAME,
        email: OWNER_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });
    ownerId = owner.id;
    ownerToken = signToken(owner);

    const existingInviteUser = await prisma.user.create({
      data: {
        fullName: "Existing Invite User",
        username: EXISTING_INVITE_USERNAME,
        email: EXISTING_INVITE_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });
    existingInviteUserId = existingInviteUser.id;

    const outsider = await prisma.user.create({
      data: {
        fullName: "Outsider",
        username: OUTSIDER_USERNAME,
        email: OUTSIDER_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });
    outsiderToken = signToken(outsider);

    const workspaceRes = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Members Test Workspace" });

    workspaceId = workspaceRes.body.data.workspace.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("auto-adds the workspace creator as an admin member", async () => {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: ownerId } },
    });

    expect(membership).not.toBeNull();
    expect(membership?.role).toBe("admin");
  });

  describe("POST /api/v1/workspaces/:workspaceId/members", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .send({ email: NEW_INVITE_EMAIL, role: "member" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when role is missing", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ email: NEW_INVITE_EMAIL });

      expect(res.status).toBe(400);
    });

    it("returns 404 when the requester isn't a member of the workspace", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .send({ email: NEW_INVITE_EMAIL, role: "member" });

      expect(res.status).toBe(404);
    });

    it("invites a brand-new email, creates the user, and returns a tempPassword", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ email: NEW_INVITE_EMAIL, role: "member" });

      expect(res.status).toBe(201);
      expect(res.body.data.member.role).toBe("member");
      expect(res.body.data.member.user.email).toBe(NEW_INVITE_EMAIL);
      expect(res.body.data.member.tempPassword).toBeDefined();

      const dbUser = await prisma.user.findUnique({
        where: { email: NEW_INVITE_EMAIL },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.role).toBe("user"); // global role — distinct from workspace role
      expect(dbUser?.mustChangePassword).toBe(true);

      // sanity: the returned tempPassword actually works
      const signinRes = await request(app).post("/api/v1/auth/signin").send({
        email: NEW_INVITE_EMAIL,
        password: res.body.data.member.tempPassword,
      });
      expect(signinRes.status).toBe(200);
    });

    it("returns 409 when inviting the same email again (already a member)", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ email: NEW_INVITE_EMAIL, role: "member" });

      expect(res.status).toBe(409);
    });

    it("invites an existing user's email without generating a tempPassword", async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ email: EXISTING_INVITE_EMAIL, role: "admin" });

      expect(res.status).toBe(201);
      expect(res.body.data.member.user.id).toBe(existingInviteUserId);
      expect(res.body.data.member.tempPassword).toBeUndefined();
    });

    it("returns 403 when a non-admin workspace member attempts to invite", async () => {
      // NEW_INVITE_EMAIL's user is a "member", not workspace admin
      const memberUser = await prisma.user.findUniqueOrThrow({
        where: { email: NEW_INVITE_EMAIL },
      });
      const memberToken = signToken(memberUser);

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ email: "irrelevant@example.com", role: "member" });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId/members", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get(
        `/api/v1/workspaces/${workspaceId}/members`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 404 for a non-member", async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });

    it("lists all members, viewable by a non-admin member too", async () => {
      const memberUser = await prisma.user.findUniqueOrThrow({
        where: { email: NEW_INVITE_EMAIL },
      });
      const memberToken = signToken(memberUser);

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.members)).toBe(true);
      expect(res.body.data.members.length).toBeGreaterThanOrEqual(3); // owner + 2 invited

      const emails = res.body.data.members.map(
        (m: { user: { email: string } }) => m.user.email,
      );
      expect(emails).toEqual(
        expect.arrayContaining([
          OWNER_EMAIL,
          NEW_INVITE_EMAIL,
          EXISTING_INVITE_EMAIL,
        ]),
      );
    });
  });

  describe("PATCH /api/v1/workspaces/:workspaceId/members/:userId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch(
          `/api/v1/workspaces/${workspaceId}/members/${existingInviteUserId}`,
        )
        .send({ role: "member" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when body is empty", async () => {
      const res = await request(app)
        .patch(
          `/api/v1/workspaces/${workspaceId}/members/${existingInviteUserId}`,
        )
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 403 when the requester tries to change their own role", async () => {
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/members/${ownerId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ role: "member" });

      expect(res.status).toBe(403);
    });

    it("returns 403 when a non-admin member attempts to patch someone else", async () => {
      const memberUser = await prisma.user.findUniqueOrThrow({
        where: { email: NEW_INVITE_EMAIL },
      });
      const memberToken = signToken(memberUser);

      const res = await request(app)
        .patch(
          `/api/v1/workspaces/${workspaceId}/members/${existingInviteUserId}`,
        )
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ role: "admin" });

      expect(res.status).toBe(403);
    });

    it("returns 404 for a userId that isn't a member of this workspace", async () => {
      const res = await request(app)
        .patch(
          `/api/v1/workspaces/${workspaceId}/members/${crypto.randomUUID()}`,
        )
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ role: "admin" });

      expect(res.status).toBe(404);
    });

    it("updates a member's role, persisted in the DB", async () => {
      const res = await request(app)
        .patch(
          `/api/v1/workspaces/${workspaceId}/members/${existingInviteUserId}`,
        )
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ role: "member" });

      expect(res.status).toBe(200);
      expect(res.body.data.member.role).toBe("member");

      const dbMembership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: existingInviteUserId },
        },
      });
      expect(dbMembership?.role).toBe("member");
    });
  });

  describe("DELETE /api/v1/workspaces/:workspaceId/members/:userId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        `/api/v1/workspaces/${workspaceId}/members/${existingInviteUserId}`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 403 when the requester tries to remove themselves", async () => {
      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}/members/${ownerId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
    });

    it("returns 403 when a non-admin member attempts to remove someone", async () => {
      const memberUser = await prisma.user.findUniqueOrThrow({
        where: { email: NEW_INVITE_EMAIL },
      });
      const memberToken = signToken(memberUser);

      const res = await request(app)
        .delete(
          `/api/v1/workspaces/${workspaceId}/members/${existingInviteUserId}`,
        )
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });

    it("returns 404 for a userId that isn't a member of this workspace", async () => {
      const res = await request(app)
        .delete(
          `/api/v1/workspaces/${workspaceId}/members/${crypto.randomUUID()}`,
        )
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
    });

    it("removes a member, deleted from the DB", async () => {
      const res = await request(app)
        .delete(
          `/api/v1/workspaces/${workspaceId}/members/${existingInviteUserId}`,
        )
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");

      const dbMembership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: existingInviteUserId },
        },
      });
      expect(dbMembership).toBeNull();

      // removing a workspace member should NOT delete the underlying User account
      const dbUser = await prisma.user.findUnique({
        where: { id: existingInviteUserId },
      });
      expect(dbUser).not.toBeNull();
    });
  });
});
