import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';
import { signupTestUser, TestUser } from './utils/auth-helper';

describe('Projects (e2e)', () => {
  let app: INestApplication<App>;
  let user: TestUser;
  const workspaceId = 'workspace-123';

  beforeAll(async () => {
    app = await createTestApp();
    user = await signupTestUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe(`POST /api/v1/workspaces/:workspaceId/projects`, () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .send({ name: 'Website Redesign' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ description: 'No name here' });

      expect(res.status).toBe(400);
    });

    it('creates a project with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/projects`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Website Redesign', description: 'Q3 refresh' });

      expect(res.status).toBe(201);
      expect(res.body.data.project).toEqual(
        expect.objectContaining({
          workspaceId,
          name: 'Website Redesign',
          description: 'Q3 refresh',
        }),
      );
    });
  });

  describe(`GET /api/v1/workspaces/:workspaceId/projects`, () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/workspaces/${workspaceId}/projects`,
      );

      expect(res.status).toBe(401);
    });

    it('returns a list of projects with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspaceId}/projects`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.projects)).toBe(true);
    });
  });

  describe(`GET /api/v1/workspaces/:workspaceId/projects/:projectId`, () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/workspaces/${workspaceId}/projects/project-456`,
      );

      expect(res.status).toBe(401);
    });

    it('returns a project with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspaceId}/projects/project-456`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.project.id).toBe('project-456');
    });
  });

  describe(`PATCH /api/v1/workspaces/:workspaceId/projects/:projectId`, () => {
    it('returns 400 when the body is empty', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspaceId}/projects/project-456`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('updates the project with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspaceId}/projects/project-456`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Renamed Project' });

      expect(res.status).toBe(200);
      expect(res.body.data.project.name).toBe('Renamed Project');
    });
  });

  describe(`DELETE /api/v1/workspaces/:workspaceId/projects/:projectId`, () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).delete(
        `/api/v1/workspaces/${workspaceId}/projects/project-456`,
      );

      expect(res.status).toBe(401);
    });

    it('deletes the project with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspaceId}/projects/project-456`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });
});
