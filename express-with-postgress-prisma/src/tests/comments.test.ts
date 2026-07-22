import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import app from "../app.ts";
import { prisma } from "../config/db.ts";

const OWNER_EMAIL = "comments-owner@example.com";
const OWNER_USERNAME = "commentsowner";

const MEMBER_EMAIL = "comments-member@example.com";
const MEMBER_USERNAME = "commentsmember";

const OUTSIDER_EMAIL = "comments-outsider@example.com";
const OUTSIDER_USERNAME = "commentsoutsider";

const TEMP_AUTHOR_EMAIL = "comments-tempauthor@example.com";
const TEMP_AUTHOR_USERNAME = "commentstempauthor";

const ALL_EMAILS = [
  OWNER_EMAIL,
  MEMBER_EMAIL,
  OUTSIDER_EMAIL,
  TEMP_AUTHOR_EMAIL,
];
const ALL_USERNAMES = [
  OWNER_USERNAME,
  MEMBER_USERNAME,
  OUTSIDER_USERNAME,
  TEMP_AUTHOR_USERNAME,
];

let ownerId: string;
let ownerToken: string;
let memberId: string;
let memberToken: string;
let outsiderToken: string;
let workspaceId: string;
let projectId: string;
let taskId: string;

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

describe("Comment routes", () => {
  beforeAll(async () => {
    await cleanup();

    const owner = await prisma.user.create({
      data: {
        fullName: "Comments Owner",
        username: OWNER_USERNAME,
        email: OWNER_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });
    ownerId = owner.id;
    ownerToken = signToken(owner);

    const member = await prisma.user.create({
      data: {
        fullName: "Comments Member",
        username: MEMBER_USERNAME,
        email: MEMBER_EMAIL,
        password: await bcrypt.hash("Password1!", 10),
        role: "admin",
        mustChangePassword: false,
      },
    });
    memberId = member.id;
    memberToken = signToken(member);

    const outsider = await prisma.user.create({
      data: {
        fullName: "Comments Outsider",
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
      .send({ name: "Comments Test Workspace" });

    workspaceId = workspaceRes.body.data.workspace.id;

    await prisma.workspaceMember.create({
      data: { workspaceId, userId: memberId, role: "member" },
    });

    const projectRes = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Comments Test Project" });

    projectId = projectRes.body.data.project.id;

    const taskRes = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Comments Test Task" });

    taskId = taskRes.body.data.task.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  describe("POST /api/v1/tasks/:taskId/comments", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .send({ content: "Looks good, ready to ship." });

      expect(res.status).toBe(401);
    });

    it("returns 400 for a malformed taskId", async () => {
      const res = await request(app)
        .post("/api/v1/tasks/not-a-uuid/comments")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ content: "Looks good, ready to ship." });

      expect(res.status).toBe(400);
    });

    it("returns 400 when content is missing", async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 400 when content is an empty string", async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ content: "" });

      expect(res.status).toBe(400);
    });

    it("returns 404 when the requester isn't a member of the task's workspace", async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .send({ content: "Should not be created" });

      expect(res.status).toBe(404);
    });

    it("returns 404 for a taskId that doesn't exist", async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${crypto.randomUUID()}/comments`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ content: "Should not be created" });

      expect(res.status).toBe(404);
    });

    it("creates a comment as a non-admin workspace member, including author details", async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ content: "Looks good, ready to ship." });

      expect(res.status).toBe(201);
      expect(res.body.data.comment.content).toBe("Looks good, ready to ship.");
      expect(res.body.data.comment.taskId).toBe(taskId);
      expect(res.body.data.comment.authorId).toBe(memberId);
      expect(res.body.data.comment.author.username).toBe(MEMBER_USERNAME);

      const dbComment = await prisma.comment.findUnique({
        where: { id: res.body.data.comment.id },
      });
      expect(dbComment).not.toBeNull();
    });
  });

  describe("GET /api/v1/tasks/:taskId/comments", () => {
    beforeAll(async () => {
      await prisma.comment.deleteMany({ where: { taskId } });

      await prisma.comment.create({
        data: { taskId, authorId: ownerId, content: "First comment" },
      });
      await new Promise((resolve) => setTimeout(resolve, 5)); // ensure distinct createdAt ordering
      await prisma.comment.create({
        data: { taskId, authorId: memberId, content: "Second comment" },
      });
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app).get(`/api/v1/tasks/${taskId}/comments`);
      expect(res.status).toBe(401);
    });

    it("returns 404 for a non-member", async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });

    it("returns comments in chronological order, with author details included", async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.comments.length).toBe(2);
      expect(res.body.data.comments[0].content).toBe("First comment");
      expect(res.body.data.comments[1].content).toBe("Second comment");
      expect(res.body.data.comments[0].author.username).toBe(OWNER_USERNAME);
      expect(res.body.data.comments[1].author.username).toBe(MEMBER_USERNAME);
    });
  });

  describe("PATCH /api/v1/tasks/:taskId/comments/:commentId", () => {
    let commentId: string;

    beforeAll(async () => {
      const comment = await prisma.comment.create({
        data: { taskId, authorId: memberId, content: "Original content" },
      });
      commentId = comment.id;
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/comments/${commentId}`)
        .send({ content: "New content" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when content is missing", async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/comments/${commentId}`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("returns 404 for a non-member of the workspace", async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/comments/${commentId}`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .send({ content: "Hijacked" });

      expect(res.status).toBe(404);
    });

    it("returns 403 when a different workspace member (not the author) tries to edit", async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/comments/${commentId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ content: "Owner trying to edit someone else's comment" });

      expect(res.status).toBe(403);
    });

    it("returns 404 for a commentId that doesn't exist", async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/comments/${crypto.randomUUID()}`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ content: "Doesn't matter" });

      expect(res.status).toBe(404);
    });

    it("returns 404 for a commentId that belongs to a different task", async () => {
      const otherTaskRes = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Other Task For Isolation Test" });

      const otherTaskId = otherTaskRes.body.data.task.id;

      const res = await request(app)
        .patch(`/api/v1/tasks/${otherTaskId}/comments/${commentId}`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ content: "Wrong task in URL" });

      expect(res.status).toBe(404);

      await prisma.task.delete({ where: { id: otherTaskId } });
    });

    it("updates the comment as its author, persisted in the DB", async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}/comments/${commentId}`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ content: "Edited content" });

      expect(res.status).toBe(200);
      expect(res.body.data.comment.content).toBe("Edited content");

      const dbComment = await prisma.comment.findUnique({
        where: { id: commentId },
      });
      expect(dbComment?.content).toBe("Edited content");
    });
  });

  describe("DELETE /api/v1/tasks/:taskId/comments/:commentId", () => {
    let commentId: string;

    beforeAll(async () => {
      const comment = await prisma.comment.create({
        data: { taskId, authorId: memberId, content: "To be deleted" },
      });
      commentId = comment.id;
    });

    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        `/api/v1/tasks/${taskId}/comments/${commentId}`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 404 for a non-member of the workspace", async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${taskId}/comments/${commentId}`)
        .set("Authorization", `Bearer ${outsiderToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 403 when a different workspace member (not the author) tries to delete", async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${taskId}/comments/${commentId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(403);
    });

    it("deletes the comment as its author, removed from the DB", async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${taskId}/comments/${commentId}`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");

      const dbComment = await prisma.comment.findUnique({
        where: { id: commentId },
      });
      expect(dbComment).toBeNull();
    });
  });

  describe("Cascade / preserve behavior", () => {
    it("deletes all comments when the parent task is deleted (task cascade unaffected by author preserve)", async () => {
      const cascadeTaskRes = await request(app)
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Cascade Test Task" });

      const cascadeTaskId = cascadeTaskRes.body.data.task.id;

      const comment = await prisma.comment.create({
        data: {
          taskId: cascadeTaskId,
          authorId: ownerId,
          content: "Should be cascaded",
        },
      });

      await request(app)
        .delete(`/api/v1/projects/${projectId}/tasks/${cascadeTaskId}`)
        .set("Authorization", `Bearer ${ownerToken}`);

      const dbComment = await prisma.comment.findUnique({
        where: { id: comment.id },
      });
      expect(dbComment).toBeNull();
    });

    it("preserves the comment with authorId/author set to null when the author is deleted", async () => {
      const tempAuthor = await prisma.user.create({
        data: {
          fullName: "Temp Comment Author",
          username: TEMP_AUTHOR_USERNAME,
          email: TEMP_AUTHOR_EMAIL,
          password: await bcrypt.hash("Password1!", 10),
          role: "admin",
          mustChangePassword: false,
        },
      });

      const comment = await prisma.comment.create({
        data: {
          taskId,
          authorId: tempAuthor.id,
          content: "Will outlive its author",
        },
      });

      await prisma.user.delete({ where: { id: tempAuthor.id } });

      const dbComment = await prisma.comment.findUnique({
        where: { id: comment.id },
      });
      expect(dbComment).not.toBeNull();
      expect(dbComment?.content).toBe("Will outlive its author");
      expect(dbComment?.authorId).toBeNull();
    });

    it("returns the orphaned comment via GET with author: null, and blocks edit/delete on it for everyone", async () => {
      const orphanRes = await request(app)
        .get(`/api/v1/tasks/${taskId}/comments`)
        .set("Authorization", `Bearer ${ownerToken}`);

      const orphanComment = orphanRes.body.data.comments.find(
        (c: { content: string }) => c.content === "Will outlive its author",
      );
      expect(orphanComment).toBeDefined();
      expect(orphanComment.authorId).toBeNull();
      expect(orphanComment.author).toBeNull();

      // even the workspace owner can't edit an orphaned comment — nobody "owns" it anymore
      const patchRes = await request(app)
        .patch(`/api/v1/tasks/${taskId}/comments/${orphanComment.id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ content: "Trying to edit an orphaned comment" });
      expect(patchRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete(`/api/v1/tasks/${taskId}/comments/${orphanComment.id}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(deleteRes.status).toBe(403);
    });
  });
});
