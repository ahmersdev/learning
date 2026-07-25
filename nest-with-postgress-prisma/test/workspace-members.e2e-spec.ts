import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';
import { signupTestUser, TestUser } from './utils/auth-helper';

describe('Workspace Members (e2e)', () => {
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

  describe(`POST /api/v1/workspaces/:workspaceId/members`, () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .send({ email: 'member@example.com', role: 'member' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when role is not a valid enum value', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ email: 'member@example.com', role: 'superadmin' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when email is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ email: 'not-an-email', role: 'member' });

      expect(res.status).toBe(400);
    });

    it('adds a member with a valid access token (requester stubbed as admin)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ email: 'member@example.com', role: 'member' });

      expect(res.status).toBe(201);
      expect(res.body.data.member).toEqual(
        expect.objectContaining({
          workspaceId,
          email: 'member@example.com',
          role: 'member',
        }),
      );
    });
  });

  describe(`GET /api/v1/workspaces/:workspaceId/members`, () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/workspaces/${workspaceId}/members`,
      );

      expect(res.status).toBe(401);
    });

    it('returns a list of members with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.members)).toBe(true);
    });
  });

  describe(`PATCH /api/v1/workspaces/:workspaceId/members/:userId`, () => {
    it('returns 400 when role is missing', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspaceId}/members/target-user-1`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('updates the member role with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspaceId}/members/target-user-1`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.data.member.role).toBe('admin');
    });
  });

  describe(`DELETE /api/v1/workspaces/:workspaceId/members/:userId`, () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).delete(
        `/api/v1/workspaces/${workspaceId}/members/target-user-1`,
      );

      expect(res.status).toBe(401);
    });

    it('removes the member with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspaceId}/members/target-user-1`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });
});
