import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';
import { signupTestUser, TestUser } from './utils/auth-helper';

describe('Workspace Members (e2e)', () => {
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

  async function addMember(
    ownerToken: string,
    workspaceId: string,
    member: TestUser,
    role: 'admin' | 'member' = 'member',
  ) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: member.email, role });

    return res.body.data.member;
  }

  describe('POST /api/v1/workspaces/:workspaceId/members', () => {
    it('returns 401 with no access token', async () => {
      const owner = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspace.id}/members`)
        .send({ email: 'member@example.com', role: 'member' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when role is not a valid enum value', async () => {
      const owner = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspace.id}/members`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: 'member@example.com', role: 'superadmin' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when email is invalid', async () => {
      const owner = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspace.id}/members`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: 'not-an-email', role: 'member' });

      expect(res.status).toBe(400);
    });

    it('returns 404 when no user exists with the given email', async () => {
      const owner = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspace.id}/members`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: 'no-such-user@example.com', role: 'member' });

      expect(res.status).toBe(404);
    });

    it('returns 403 when the requester is a member, not an admin', async () => {
      const owner = await signupTestUser(app);
      const plainMember = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);
      await addMember(owner.accessToken, workspace.id, plainMember, 'member');

      const outsider = await signupTestUser(app);
      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspace.id}/members`)
        .set('Authorization', `Bearer ${plainMember.accessToken}`)
        .send({ email: outsider.email, role: 'member' });

      expect(res.status).toBe(403);
    });

    it('adds a member with a valid admin access token', async () => {
      const owner = await signupTestUser(app);
      const newMember = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspace.id}/members`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: newMember.email, role: 'member' });

      expect(res.status).toBe(201);
      expect(res.body.data.member).toEqual(
        expect.objectContaining({
          workspaceId: workspace.id,
          role: 'member',
        }),
      );
    });

    it('returns 409 when the user is already a member', async () => {
      const owner = await signupTestUser(app);
      const newMember = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);
      await addMember(owner.accessToken, workspace.id, newMember, 'member');

      const res = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspace.id}/members`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: newMember.email, role: 'member' });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/v1/workspaces/:workspaceId/members', () => {
    it('returns 401 with no access token', async () => {
      const owner = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer()).get(
        `/api/v1/workspaces/${workspace.id}/members`,
      );

      expect(res.status).toBe(401);
    });

    it('returns 404 when the requester is not a member of the workspace', async () => {
      const owner = await signupTestUser(app);
      const outsider = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspace.id}/members`)
        .set('Authorization', `Bearer ${outsider.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('returns the member list, including the owner, to any member', async () => {
      const owner = await signupTestUser(app);
      const plainMember = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);
      await addMember(owner.accessToken, workspace.id, plainMember, 'member');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspace.id}/members`)
        .set('Authorization', `Bearer ${plainMember.accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.members)).toBe(true);
      expect(res.body.data.members.length).toBe(2);
    });
  });

  describe('PATCH /api/v1/workspaces/:workspaceId/members/:userId', () => {
    it('returns 400 when role is missing', async () => {
      const owner = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/workspaces/${workspace.id}/members/${owner.accessToken}`,
        )
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 403 when the requester is not an admin', async () => {
      const owner = await signupTestUser(app);
      const plainMember = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);
      const membership = await addMember(
        owner.accessToken,
        workspace.id,
        plainMember,
        'member',
      );

      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/workspaces/${workspace.id}/members/${membership.userId}`,
        )
        .set('Authorization', `Bearer ${plainMember.accessToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
    });

    it('returns 403 when trying to change the workspace owner’s role', async () => {
      const owner = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/workspaces/${workspace.id}/members/${workspace.ownerId}`,
        )
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ role: 'member' });

      expect(res.status).toBe(403);
    });

    it('returns 404 when the target user has no membership', async () => {
      const owner = await signupTestUser(app);
      const notAMember = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/workspaces/${workspace.id}/members/${notAMember.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(404);
    });

    it('updates the member role with a valid admin access token', async () => {
      const owner = await signupTestUser(app);
      const plainMember = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);
      const membership = await addMember(
        owner.accessToken,
        workspace.id,
        plainMember,
        'member',
      );

      const res = await request(app.getHttpServer())
        .patch(
          `/api/v1/workspaces/${workspace.id}/members/${membership.userId}`,
        )
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.data.member.role).toBe('admin');
    });
  });

  describe('DELETE /api/v1/workspaces/:workspaceId/members/:userId', () => {
    it('returns 401 with no access token', async () => {
      const owner = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer()).delete(
        `/api/v1/workspaces/${workspace.id}/members/some-user-id`,
      );

      expect(res.status).toBe(401);
    });

    it('returns 403 when trying to remove the workspace owner', async () => {
      const owner = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);

      const res = await request(app.getHttpServer())
        .delete(
          `/api/v1/workspaces/${workspace.id}/members/${workspace.ownerId}`,
        )
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(403);
    });

    it('removes the member with a valid admin access token', async () => {
      const owner = await signupTestUser(app);
      const plainMember = await signupTestUser(app);
      const workspace = await createWorkspace(owner.accessToken);
      const membership = await addMember(
        owner.accessToken,
        workspace.id,
        plainMember,
        'member',
      );

      const deleteRes = await request(app.getHttpServer())
        .delete(
          `/api/v1/workspaces/${workspace.id}/members/${membership.userId}`,
        )
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.status).toBe('success');

      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspace.id}/members`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(listRes.body.data.members.length).toBe(1);
    });
  });
});
