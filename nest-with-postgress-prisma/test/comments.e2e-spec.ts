import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';
import { signupTestUser, TestUser } from './utils/auth-helper';

describe('Comments (e2e)', () => {
  let app: INestApplication<App>;
  let user: TestUser;
  const taskId = 'task-123';

  beforeAll(async () => {
    app = await createTestApp();
    user = await signupTestUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe(`POST /api/v1/tasks/:taskId/comments`, () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${taskId}/comments`)
        .send({ content: 'Looks good.' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when content is missing', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when content is an empty string', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ content: '   ' });

      expect(res.status).toBe(400);
    });

    it('creates a comment with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ content: 'Looks good, ready to ship.' });

      expect(res.status).toBe(201);
      expect(res.body.data.comment).toEqual(
        expect.objectContaining({
          taskId,
          content: 'Looks good, ready to ship.',
        }),
      );
    });
  });

  describe(`GET /api/v1/tasks/:taskId/comments`, () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/tasks/${taskId}/comments`,
      );

      expect(res.status).toBe(401);
    });

    it('returns a list of comments with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.comments)).toBe(true);
    });
  });

  describe(`PATCH /api/v1/tasks/:taskId/comments/:commentId`, () => {
    it('returns 400 when content is missing', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${taskId}/comments/comment-456`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('updates the comment with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${taskId}/comments/comment-456`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ content: 'Edited comment' });

      expect(res.status).toBe(200);
      expect(res.body.data.comment.content).toBe('Edited comment');
    });
  });

  describe(`DELETE /api/v1/tasks/:taskId/comments/:commentId`, () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).delete(
        `/api/v1/tasks/${taskId}/comments/comment-456`,
      );

      expect(res.status).toBe(401);
    });

    it('deletes the comment with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${taskId}/comments/comment-456`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });
});
