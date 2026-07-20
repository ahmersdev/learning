import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import app from "../app.ts";

const outsiderUser = {
  fullName: "Outsider User",
  username: "outsideruser",
  email: "outsider@example.com",
  password: "Password1!",
};

let userCounter = 0;

const makeUniqueUser = () => {
  userCounter += 1;
  return {
    fullName: `Test User ${userCounter}`,
    username: `testuser${userCounter}`,
    email: `testuser${userCounter}@example.com`,
    password: "Password1!",
  };
};

const signupAndGetToken = async (user = makeUniqueUser()): Promise<string> => {
  const res = await request(app).post("/api/v1/auth/signup").send(user);
  return res.body.data.accessToken;
};

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

describe("Project routes", () => {
  describe("POST /api/v1/workspaces/:workspaceId/projects", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .post("/api/v1/workspaces/000000000000000000000000/projects")
        .send({ name: "Website Redesign" });

      expect(res.status).toBe(401);
    });

    it("returns 400 for a malformed workspaceId", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/workspaces/not-a-valid-id/projects")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Website Redesign" });

      expect(res.status).toBe(400);
    });

    it("returns 404 when the workspace doesn't exist", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .post("/api/v1/workspaces/000000000000000000000000/projects")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Website Redesign" });

      expect(res.status).toBe(404);
    });

    it("returns 404 when the requester isn't a member of the workspace", async () => {
      const { workspaceId } = await createWorkspaceAsAdmin();
      const outsiderToken = await signupAndGetToken(outsiderUser);

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .send({ name: "Website Redesign" });

      expect(res.status).toBe(404);
    });

    it("returns 400 when name is missing", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ description: "No name" });

      expect(res.status).toBe(400);
    });

    it("returns 400 when name is empty string", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "" });

      expect(res.status).toBe(400);
    });

    it("creates a project with valid data", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Website Redesign", description: "Q3 refresh" });

      expect(res.status).toBe(201);
      expect(res.body.data.project.name).toBe("Website Redesign");
      expect(res.body.data.project.workspaceId).toBe(workspaceId);
    });

    it("allows a regular (non-admin) workspace member to create a project", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const addRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "member@example.com", role: "member" });

      const signinRes = await request(app).post("/api/v1/auth/signin").send({
        email: "member@example.com",
        password: addRes.body.data.temporaryPassword,
      });

      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${signinRes.body.data.accessToken}`)
        .send({ name: "Member Created Project" });

      expect(res.status).toBe(201);
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId/projects", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get(
        "/api/v1/workspaces/000000000000000000000000/projects",
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 for a malformed workspaceId", async () => {
      const accessToken = await signupAndGetToken();

      const res = await request(app)
        .get("/api/v1/workspaces/not-a-valid-id/projects")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
    });

    it("returns only projects belonging to the given workspace", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();
      const { workspaceId: otherWorkspaceId } = await createWorkspaceAsAdmin();

      await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "In This Workspace" });

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.projects).toHaveLength(1);
      expect(res.body.data.projects[0].name).toBe("In This Workspace");
    });
  });

  describe("GET /api/v1/workspaces/:workspaceId/projects/:projectId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).get(
        "/api/v1/workspaces/000000000000000000000000/projects/000000000000000000000000",
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 for a malformed projectId", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/not-a-valid-id`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(400);
    });

    it("returns a project with a valid token", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const createRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Website Redesign" });

      const projectId = createRes.body.data.project.id;

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.project.id).toBe(projectId);
    });

    it("returns 404 for a project that belongs to a different workspace", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();
      const { accessToken: otherAccessToken, workspaceId: otherWorkspaceId } =
        await createWorkspaceAsAdmin();

      const createRes = await request(app)
        .post(`/api/v1/workspaces/${otherWorkspaceId}/projects`)
        .set("Authorization", `Bearer ${otherAccessToken}`)
        .send({ name: "Not In This Workspace" });

      const projectId = createRes.body.data.project.id;

      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/workspaces/:workspaceId/projects/:projectId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app)
        .patch(
          "/api/v1/workspaces/000000000000000000000000/projects/000000000000000000000000",
        )
        .send({ name: "New Name" });

      expect(res.status).toBe(401);
    });

    it("returns 400 when body is empty", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const createRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Website Redesign" });

      const projectId = createRes.body.data.project.id;

      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it("updates name and persists it", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const createRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Old Name" });

      const projectId = createRes.body.data.project.id;

      const patchRes = await request(app)
        .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Renamed Project" });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.project.name).toBe("Renamed Project");

      const getRes = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(getRes.body.data.project.name).toBe("Renamed Project");
    });
  });

  describe("DELETE /api/v1/workspaces/:workspaceId/projects/:projectId", () => {
    it("returns 401 with no access token", async () => {
      const res = await request(app).delete(
        "/api/v1/workspaces/000000000000000000000000/projects/000000000000000000000000",
      );
      expect(res.status).toBe(401);
    });

    it("deletes a project", async () => {
      const { accessToken, workspaceId } = await createWorkspaceAsAdmin();

      const createRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "To Delete" });

      const projectId = createRes.body.data.project.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(deleteRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(getRes.status).toBe(404);
    });
  });
});
