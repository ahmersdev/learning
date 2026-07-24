import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';
import { signupTestUser, TestUser } from './utils/auth-helper';

describe('Tasks (e2e)', () => {
  let app: INestApplication<App>;
  let user: TestUser;
  const projectId = 'project-123';

  beforeAll(async () => {
    app = await createTestApp();
    user = await signupTestUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe(`POST /api/v1/projects/:projectId/tasks`, () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${projectId}/tasks`)
        .send({ title: 'Design homepage mockup' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ description: 'No title here' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid status value', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'Task', status: 'not_a_status' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid dueDate', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'Task', dueDate: 'not-a-date' });

      expect(res.status).toBe(400);
    });

    it('creates a task with defaults when only title is provided', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'Design homepage mockup' });

      expect(res.status).toBe(201);
      expect(res.body.data.task).toEqual(
        expect.objectContaining({
          title: 'Design homepage mockup',
          status: 'backlog',
          priority: 'medium',
        }),
      );
    });
  });

  describe(`GET /api/v1/projects/:projectId/tasks`, () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/projects/${projectId}/tasks`,
      );

      expect(res.status).toBe(401);
    });

    it('returns tasks with default pagination when no query params are given', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toEqual(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it('coerces page and limit query strings into numbers', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}/tasks`)
        .query({ page: '3', limit: '50' })
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(3);
      expect(res.body.data.pagination.limit).toBe(50);
    });

    it('returns 400 when limit exceeds the max of 100', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}/tasks`)
        .query({ limit: '500' })
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid sortOrder value', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}/tasks`)
        .query({ sortBy: 'dueDate', sortOrder: 'upward' })
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(400);
    });

    it('returns 400 for an unknown query parameter', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}/tasks`)
        .query({ unknownParam: 'value' })
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(400);
    });

    it('applies a valid status filter', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}/tasks`)
        .query({ status: 'done' })
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks[0].status).toBe('done');
    });
  });

  describe(`GET /api/v1/projects/:projectId/tasks/:taskId`, () => {
    it('returns a task with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}/tasks/task-456`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.task.id).toBe('task-456');
    });
  });

  describe(`PATCH /api/v1/projects/:projectId/tasks/:taskId`, () => {
    it('returns 400 when the body is empty', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${projectId}/tasks/task-456`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('updates the task with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${projectId}/tasks/task-456`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ status: 'done' });

      expect(res.status).toBe(200);
      expect(res.body.data.task.status).toBe('done');
    });
  });

  describe(`DELETE /api/v1/projects/:projectId/tasks/:taskId`, () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).delete(
        `/api/v1/projects/${projectId}/tasks/task-456`,
      );

      expect(res.status).toBe(401);
    });

    it('deletes the task with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${projectId}/tasks/task-456`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });
});
