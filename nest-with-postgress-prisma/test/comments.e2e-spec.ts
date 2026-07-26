import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';
import { signupTestUser, TestUser } from './utils/auth-helper';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Comments (e2e)', () => {
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

  async function createProject(ownerToken: string, workspaceId: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Website Redesign' });
    return res.body.data.project;
  }

  async function createTask(ownerToken: string, projectId: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Design homepage mockup' });
    return res.body.data.task;
  }

  async function addMember(
    ownerToken: string,
    workspaceId: string,
    member: TestUser,
    role: 'admin' | 'member' = 'member',
  ) {
    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: member.email, role });
  }

  async function setupTaskWithOwner() {
    const owner = await signupTestUser(app);
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.id);
    const task = await createTask(owner.accessToken, project.id);
    return { owner, workspace, project, task };
  }

  async function createComment(
    token: string,
    taskId: string,
    content = 'Looks good, ready to ship.',
  ) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });
    return res.body.data.comment;
  }

  describe('POST /api/v1/tasks/:taskId/comments', () => {
    it('returns 401 with no access token', async () => {
      const { task } = await setupTaskWithOwner();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${task.id}/comments`)
        .send({ content: 'Looks good.' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when content is missing', async () => {
      const { owner, task } = await setupTaskWithOwner();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when content is an empty/whitespace-only string', async () => {
      const { owner, task } = await setupTaskWithOwner();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ content: '   ' });

      expect(res.status).toBe(400);
    });

    it('returns 404 when the requester is not a member of the task’s workspace', async () => {
      const { task } = await setupTaskWithOwner();
      const outsider = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({ content: 'Should not work.' });

      expect(res.status).toBe(404);
    });

    it('creates a comment with a valid access token', async () => {
      const { owner, task } = await setupTaskWithOwner();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${task.id}/comments`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ content: 'Looks good, ready to ship.' });

      expect(res.status).toBe(201);
      expect(res.body.data.comment).toEqual(
        expect.objectContaining({
          taskId: task.id,
          authorId: owner.id,
          content: 'Looks good, ready to ship.',
        }),
      );
    });
  });

  describe('GET /api/v1/tasks/:taskId/comments', () => {
    it('returns 401 with no access token', async () => {
      const { task } = await setupTaskWithOwner();

      const res = await request(app.getHttpServer()).get(
        `/api/v1/tasks/${task.id}/comments`,
      );

      expect(res.status).toBe(401);
    });

    it('returns 404 when the requester is not a member of the task’s workspace', async () => {
      const { task } = await setupTaskWithOwner();
      const outsider = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${task.id}/comments`)
        .set('Authorization', `Bearer ${outsider.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('returns comments in chronological order', async () => {
      const { owner, task } = await setupTaskWithOwner();
      await createComment(owner.accessToken, task.id, 'First');
      await createComment(owner.accessToken, task.id, 'Second');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${task.id}/comments`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.comments).toHaveLength(2);
      expect(res.body.data.comments[0].content).toBe('First');
      expect(res.body.data.comments[1].content).toBe('Second');
    });
  });

  describe('PATCH /api/v1/tasks/:taskId/comments/:commentId', () => {
    it('returns 400 when content is missing', async () => {
      const { owner, task } = await setupTaskWithOwner();
      const comment = await createComment(owner.accessToken, task.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 403 when the requester is not the comment’s author', async () => {
      const { owner, workspace, task } = await setupTaskWithOwner();
      const otherMember = await signupTestUser(app);
      await addMember(owner.accessToken, workspace.id, otherMember);
      const comment = await createComment(owner.accessToken, task.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
        .set('Authorization', `Bearer ${otherMember.accessToken}`)
        .send({ content: 'Trying to edit someone else’s comment' });

      expect(res.status).toBe(403);
    });

    it('updates the comment when the requester is the author', async () => {
      const { owner, task } = await setupTaskWithOwner();
      const comment = await createComment(owner.accessToken, task.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ content: 'Edited comment' });

      expect(res.status).toBe(200);
      expect(res.body.data.comment.content).toBe('Edited comment');
    });

    it('permanently locks a comment from edits once its author has been deleted', async () => {
      const { owner, workspace, task } = await setupTaskWithOwner();
      const author = await signupTestUser(app);
      await addMember(owner.accessToken, workspace.id, author);
      const comment = await createComment(author.accessToken, task.id);

      const prisma = app.get(PrismaService);
      await prisma.user.delete({ where: { id: author.id } });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ content: 'Owner trying to edit a dead user’s comment' });

      expect(res.status).toBe(403);

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${task.id}/comments`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      const preserved = getRes.body.data.comments.find(
        (c: { id: string }) => c.id === comment.id,
      );
      expect(preserved).toBeDefined();
      expect(preserved.authorId).toBeNull();
      expect(preserved.content).toBe('Looks good, ready to ship.');
    });
  });

  describe('DELETE /api/v1/tasks/:taskId/comments/:commentId', () => {
    it('returns 401 with no access token', async () => {
      const { owner, task } = await setupTaskWithOwner();
      const comment = await createComment(owner.accessToken, task.id);

      const res = await request(app.getHttpServer()).delete(
        `/api/v1/tasks/${task.id}/comments/${comment.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('returns 403 when the requester is not the comment’s author', async () => {
      const { owner, workspace, task } = await setupTaskWithOwner();
      const otherMember = await signupTestUser(app);
      await addMember(owner.accessToken, workspace.id, otherMember);
      const comment = await createComment(owner.accessToken, task.id);

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
        .set('Authorization', `Bearer ${otherMember.accessToken}`);

      expect(res.status).toBe(403);
    });

    it('deletes the comment when the requester is the author, and it becomes unreachable after', async () => {
      const { owner, task } = await setupTaskWithOwner();
      const comment = await createComment(owner.accessToken, task.id);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.status).toBe('success');

      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${task.id}/comments`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(listRes.body.data.comments).toHaveLength(0);
    });
  });
});
