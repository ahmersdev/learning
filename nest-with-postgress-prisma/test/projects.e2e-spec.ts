import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';
import { signupTestUser, TestUser } from './utils/auth-helper';

describe('Projects (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createWorkspace(ownerToken: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Marketing Team' });

    return res.body.data.workspace;
  }

  async function createProject(
    ownerToken: string,
    workspaceId: string,
    overrides = {},
  ) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Website Redesign',
        description: 'Q3 refresh',
        ...overrides,
      });

    return res.body.data.project;
  }

  async function setupWorkspaceWithOwner() {
    const owner = await signupTestUser(app);
    const workspace = await createWorkspace(owner.accessToken);
    return { owner, workspace };
  }

  describe('POST /api/v1/workspaces/:workspaceId/projects', () => {
    it('returns 401 with no access token', async () => {
      const { workspace } = await setupWorkspaceWithOwner();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .send({ name: 'Website Redesign' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when name is missing', async () => {
      const { owner, workspace } = await setupWorkspaceWithOwner();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ description: 'No name here' });

      expect(res.status).toBe(400);
    });

    it('returns 404 when the requester is not a member of the workspace', async () => {
      const { workspace } = await setupWorkspaceWithOwner();
      const outsider = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({ name: 'Website Redesign' });

      expect(res.status).toBe(404);
    });

    it('creates a project with a valid access token', async () => {
      const { owner, workspace } = await setupWorkspaceWithOwner();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspace.id}/projects`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Website Redesign', description: 'Q3 refresh' });

      expect(res.status).toBe(201);
      expect(res.body.data.project).toEqual(
        expect.objectContaining({
          workspaceId: workspace.id,
          name: 'Website Redesign',
          description: 'Q3 refresh',
        }),
      );
    });
  });

  describe('GET /api/v1/workspaces/:workspaceId/projects', () => {
    it('returns 401 with no access token', async () => {
      const { workspace } = await setupWorkspaceWithOwner();

      const res = await request(app.getHttpServer()).get(
        `/api/v1/workspaces/${workspace.id}/projects`,
      );

      expect(res.status).toBe(401);
    });

    it('returns 404 when the requester is not a member of the workspace', async () => {
      const { workspace } = await setupWorkspaceWithOwner();
      const outsider = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspace.id}/projects`)
        .set('Authorization', `Bearer ${outsider.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('returns a list of projects with a valid access token', async () => {
      const { owner, workspace } = await setupWorkspaceWithOwner();
      await createProject(owner.accessToken, workspace.id);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspace.id}/projects`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.projects)).toBe(true);
      expect(res.body.data.projects.length).toBe(1);
    });
  });

  describe('GET /api/v1/workspaces/:workspaceId/projects/:projectId', () => {
    it('returns 401 with no access token', async () => {
      const { owner, workspace } = await setupWorkspaceWithOwner();
      const project = await createProject(owner.accessToken, workspace.id);

      const res = await request(app.getHttpServer()).get(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('returns 404 when the project does not exist in this workspace', async () => {
      const { owner, workspace } = await setupWorkspaceWithOwner();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspace.id}/projects/nonexistent-id`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('returns a project with a valid access token', async () => {
      const { owner, workspace } = await setupWorkspaceWithOwner();
      const project = await createProject(owner.accessToken, workspace.id);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspace.id}/projects/${project.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.project.id).toBe(project.id);
    });
  });

  describe('PATCH /api/v1/workspaces/:workspaceId/projects/:projectId', () => {
    it('returns 400 when the body is empty', async () => {
      const { owner, workspace } = await setupWorkspaceWithOwner();
      const project = await createProject(owner.accessToken, workspace.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspace.id}/projects/${project.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 when the project does not exist in this workspace', async () => {
      const { owner, workspace } = await setupWorkspaceWithOwner();

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspace.id}/projects/nonexistent-id`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Renamed' });

      expect(res.status).toBe(404);
    });

    it('updates the project with a valid access token', async () => {
      const { owner, workspace } = await setupWorkspaceWithOwner();
      const project = await createProject(owner.accessToken, workspace.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspace.id}/projects/${project.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Renamed Project' });

      expect(res.status).toBe(200);
      expect(res.body.data.project.name).toBe('Renamed Project');
    });
  });

  describe('DELETE /api/v1/workspaces/:workspaceId/projects/:projectId', () => {
    it('returns 401 with no access token', async () => {
      const { owner, workspace } = await setupWorkspaceWithOwner();
      const project = await createProject(owner.accessToken, workspace.id);

      const res = await request(app.getHttpServer()).delete(
        `/api/v1/workspaces/${workspace.id}/projects/${project.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('returns 404 when the project does not exist in this workspace', async () => {
      const { owner, workspace } = await setupWorkspaceWithOwner();

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspace.id}/projects/nonexistent-id`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('deletes the project with a valid access token, and it becomes unreachable after', async () => {
      const { owner, workspace } = await setupWorkspaceWithOwner();
      const project = await createProject(owner.accessToken, workspace.id);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspace.id}/projects/${project.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.status).toBe('success');

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspace.id}/projects/${project.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(getRes.status).toBe(404);
    });
  });
});
