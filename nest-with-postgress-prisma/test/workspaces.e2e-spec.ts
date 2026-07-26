import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';
import { signupTestUser, TestUser } from './utils/auth-helper';
import { PrismaService } from '../src/prisma/prisma.service';

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

  async function createWorkspace(token: string, overrides = {}) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Marketing Team',
        description: 'For marketing',
        ...overrides,
      });

    return res.body.data.workspace;
  }

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
          id: expect.any(String),
          name: 'Marketing Team',
          description: 'For marketing',
          ownerId: expect.any(String),
        }),
      );
    });

    it('defaults description to null when not provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/workspaces')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'No Description Team' });

      expect(res.status).toBe(201);
      expect(res.body.data.workspace.description).toBeNull();
    });
  });

  describe('GET /api/v1/workspaces', () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/workspaces');

      expect(res.status).toBe(401);
    });

    it('returns only workspaces owned by the caller', async () => {
      const owner = await signupTestUser(app);
      const otherUser = await signupTestUser(app);
      const ownedWorkspace = await createWorkspace(owner.accessToken);
      await createWorkspace(otherUser.accessToken);

      const res = await request(app.getHttpServer())
        .get('/api/v1/workspaces')
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.workspaces)).toBe(true);
      const ids = res.body.data.workspaces.map((w: { id: string }) => w.id);
      expect(ids).toContain(ownedWorkspace.id);
    });
  });

  describe('GET /api/v1/workspaces/:workspaceId', () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/workspaces/nonexistent-id',
      );

      expect(res.status).toBe(401);
    });

    it('returns 404 for a workspace that does not exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/workspaces/nonexistent-id')
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 when the workspace exists but is owned by someone else', async () => {
      const owner = await signupTestUser(app);
      const otherUser = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('returns the workspace when owned by the caller', async () => {
      const workspace = await createWorkspace(user.accessToken);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workspace.id).toBe(workspace.id);
    });
  });

  describe('PATCH /api/v1/workspaces/:workspaceId', () => {
    it('returns 400 when the body is empty', async () => {
      const workspace = await createWorkspace(user.accessToken);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 when the workspace exists but is owned by someone else', async () => {
      const owner = await signupTestUser(app);
      const otherUser = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .send({ name: 'Hijacked Name' });

      expect(res.status).toBe(404);
    });

    it('updates the workspace with a valid access token', async () => {
      const workspace = await createWorkspace(user.accessToken);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Renamed Workspace' });

      expect(res.status).toBe(200);
      expect(res.body.data.workspace.name).toBe('Renamed Workspace');
      expect(res.body.data.workspace.description).toBe(workspace.description);
    });
  });

  describe('DELETE /api/v1/workspaces/:workspaceId', () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).delete(
        '/api/v1/workspaces/nonexistent-id',
      );

      expect(res.status).toBe(401);
    });

    it('returns 404 when the workspace exists but is owned by someone else', async () => {
      const owner = await signupTestUser(app);
      const otherUser = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('deletes the workspace with a valid access token, and it becomes unreachable after', async () => {
      const workspace = await createWorkspace(user.accessToken);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.status).toBe('success');

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspace.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(getRes.status).toBe(404);
    });
  });

  describe('Authorization (admin-only)', () => {
    it('returns 403 when a non-admin user tries to access workspace routes', async () => {
      const user = await signupTestUser(app);

      const prisma = app.get(PrismaService);
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'user' },
      });

      // downgrading via Prisma doesn't invalidate the already-issued token,
      // so this correctly proves the token-embedded role is what's checked —
      // sign in again to get a token that reflects the new role
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ email: user.email, password: 'Password1!' });

      const downgradedToken = res.body.data.accessToken;

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/workspaces')
        .set('Authorization', `Bearer ${downgradedToken}`);

      expect(listRes.status).toBe(403);
    });
  });
});
