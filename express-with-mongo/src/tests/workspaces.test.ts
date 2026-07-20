import { describe, it, expect } from "@jest/globals";
import request from "supertest";
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

describe("Workspace routes", () => {
  describe("POST /api/v1/workspaces", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces")
        .send({ name: "Marketing Team" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when name is missing", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ description: "No name provided" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when name is empty string", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when an unknown field is sent", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Marketing Team", owner: "someone-else" });

      expect(res.status).toBe(400);
    });

    it("creates a workspace with valid data, owned by the requester", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Marketing Team",
          description: "For the marketing team",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.workspace.name).toBe("Marketing Team");
      expect(res.body.data.workspace.id).toBeDefined();
      expect(res.body.data.workspace.ownerId).toBeDefined();
    });

    it("creates a workspace without a description", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "No Description Workspace" });

      expect(res.status).toBe(201);
      expect(res.body.data.workspace.description).toBeNull();
    });
  });

  describe("GET /api/v1/workspaces", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get("/api/v1/workspaces");
      expect(res.status).toBe(401);
    });

    it("returns only the requester's own workspaces", async () => {
      const accessToken = await signupAndGetToken();
      const otherAccessToken = await signupAndGetToken(otherUser);

      await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Mine" });

      await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${otherAccessToken}`)
        .send({ name: "Not Mine" });

      const res = await request(app)
        .get("/api/v1/workspaces")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workspaces).toHaveLength(1);
      expect(res.body.data.workspaces[0].name).toBe("Mine");
    });

    it("returns an empty list when the user owns no workspaces", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .get("/api/v1/workspaces")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workspaces).toEqual([]);
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get(
        "/api/v1/workspaces/000000000000000000000000",
      );
      expect(res.status).toBe(401);
    });

    it("returns the workspace when owned by the requester", async () => {
      const accessToken = await signupAndGetToken();

      const createRes = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "My Workspace" });

      const workspaceId = createRes.body.data.workspace.id;

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workspace.id).toBe(workspaceId);
    });

    it("returns 404 for a workspace owned by someone else", async () => {
      const accessToken = await signupAndGetToken();
      const otherAccessToken = await signupAndGetToken(otherUser);

      const createRes = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${otherAccessToken}`)
        .send({ name: "Not Yours" });

      const workspaceId = createRes.body.data.workspace.id;

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 404 for a nonexistent workspace", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .get("/api/v1/workspaces/000000000000000000000000")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/workspaces/:workspaceId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch("/api/v1/workspaces/000000000000000000000000")
        .send({ name: "New Name" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when body is empty", async () => {
      const accessToken = await signupAndGetToken();

      const createRes = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Workspace" });

      const workspaceId = createRes.body.data.workspace.id;

      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("updates name only and persists it", async () => {
      const accessToken = await signupAndGetToken();

      const createRes = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Old Name" });

      const workspaceId = createRes.body.data.workspace.id;

      const patchRes = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Renamed Workspace" });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.workspace.name).toBe("Renamed Workspace");

      const getRes = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(getRes.body.data.workspace.name).toBe("Renamed Workspace");
    });

    it("returns 404 when patching a workspace owned by someone else", async () => {
      const accessToken = await signupAndGetToken();
      const otherAccessToken = await signupAndGetToken(otherUser);

      const createRes = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${otherAccessToken}`)
        .send({ name: "Not Yours" });

      const workspaceId = createRes.body.data.workspace.id;

      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Hijacked Name" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/workspaces/:workspaceId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        "/api/v1/workspaces/000000000000000000000000",
      );
      expect(res.status).toBe(401);
    });

    it("deletes a workspace owned by the requester", async () => {
      const accessToken = await signupAndGetToken();

      const createRes = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "To Delete" });

      const workspaceId = createRes.body.data.workspace.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(deleteRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(getRes.status).toBe(404);
    });

    it("returns 404 when deleting a workspace owned by someone else", async () => {
      const accessToken = await signupAndGetToken();
      const otherAccessToken = await signupAndGetToken(otherUser);

      const createRes = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${otherAccessToken}`)
        .send({ name: "Not Yours" });

      const workspaceId = createRes.body.data.workspace.id;

      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });
  });
});
