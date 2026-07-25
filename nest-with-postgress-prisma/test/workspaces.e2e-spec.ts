import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';
import { signupTestUser, TestUser } from './utils/auth-helper';

describe('Workspaces (e2e)', () => {
  let app: INestApplication<App>;
  let user: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    user = await signupTestUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/workspaces', () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workspaces')
        .send({ name: 'Marketing Team' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workspaces')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ description: 'No name here' });

      expect(res.status).toBe(400);
    });

    it('creates a workspace with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workspaces')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Marketing Team', description: 'For marketing' });

      expect(res.status).toBe(201);
      expect(res.body.data.workspace).toEqual(
        expect.objectContaining({
          name: 'Marketing Team',
          description: 'For marketing',
        }),
      );
    });
  });

  describe('GET /api/v1/workspaces', () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/workspaces');

      expect(res.status).toBe(401);
    });

    it('returns a list of workspaces with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/workspaces')
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.workspaces)).toBe(true);
    });
  });

  describe('GET /api/v1/workspaces/:workspaceId', () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/workspaces/workspace-123',
      );

      expect(res.status).toBe(401);
    });

    it('returns a workspace with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/workspaces/workspace-123')
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workspace.id).toBe('workspace-123');
    });
  });

  describe('PATCH /api/v1/workspaces/:workspaceId', () => {
    it('returns 400 when the body is empty', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/workspaces/workspace-123')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('updates the workspace with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/workspaces/workspace-123')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Renamed Workspace' });

      expect(res.status).toBe(200);
      expect(res.body.data.workspace.name).toBe('Renamed Workspace');
    });
  });

  describe('DELETE /api/v1/workspaces/:workspaceId', () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).delete(
        '/api/v1/workspaces/workspace-123',
      );

      expect(res.status).toBe(401);
    });

    it('deletes the workspace with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/workspaces/workspace-123')
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });
});
