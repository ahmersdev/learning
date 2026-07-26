import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { createTestApp } from './utils/create-test-app';
import { signupTestUser, TestUser } from './utils/auth-helper';

describe('Tasks (e2e)', () => {
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

  async function setupProjectWithOwner() {
    const owner = await signupTestUser(app);
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.id);
    return { owner, workspace, project };
  }

  async function createTask(
    ownerToken: string,
    projectId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Design homepage mockup', ...overrides });
    return res.body.data.task;
  }

  describe('POST /api/v1/projects/:projectId/tasks', () => {
    it('returns 401 with no access token', async () => {
      const { project } = await setupProjectWithOwner();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${project.id}/tasks`)
        .send({ title: 'Design homepage mockup' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when title is missing', async () => {
      const { owner, project } = await setupProjectWithOwner();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ description: 'No title here' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid status value', async () => {
      const { owner, project } = await setupProjectWithOwner();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'Task', status: 'not_a_status' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid dueDate', async () => {
      const { owner, project } = await setupProjectWithOwner();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'Task', dueDate: 'not-a-date' });

      expect(res.status).toBe(400);
    });

    it('returns 404 when the requester is not a member of the project’s workspace', async () => {
      const { project } = await setupProjectWithOwner();
      const outsider = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${outsider.accessToken}`)
        .send({ title: 'Task' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when assigneeId is not a member of the workspace', async () => {
      const { owner, project } = await setupProjectWithOwner();
      const outsider = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'Task', assigneeId: outsider.id });

      expect(res.status).toBe(400);
    });

    it('creates a task with defaults when only title is provided', async () => {
      const { owner, project } = await setupProjectWithOwner();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'Design homepage mockup' });

      expect(res.status).toBe(201);
      expect(res.body.data.task).toEqual(
        expect.objectContaining({
          title: 'Design homepage mockup',
          status: 'backlog',
          priority: 'medium',
          assigneeId: null,
        }),
      );
    });

    it('creates a task assigned to a real workspace member', async () => {
      const { owner, workspace, project } = await setupProjectWithOwner();
      const member = await signupTestUser(app);
      await addMember(owner.accessToken, workspace.id, member);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'Assigned task', assigneeId: member.id });

      expect(res.status).toBe(201);
      expect(res.body.data.task.assigneeId).toBe(member.id);
    });
  });

  describe('GET /api/v1/projects/:projectId/tasks', () => {
    it('returns 401 with no access token', async () => {
      const { project } = await setupProjectWithOwner();

      const res = await request(app.getHttpServer()).get(
        `/api/v1/projects/${project.id}/tasks`,
      );

      expect(res.status).toBe(401);
    });

    it('returns 404 when the requester is not a member of the project’s workspace', async () => {
      const { project } = await setupProjectWithOwner();
      const outsider = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${outsider.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('returns tasks with default pagination when no query params are given', async () => {
      const { owner, project } = await setupProjectWithOwner();
      await createTask(owner.accessToken, project.id);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        }),
      );
    });

    it('coerces page and limit query strings into numbers', async () => {
      const { owner, project } = await setupProjectWithOwner();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}/tasks`)
        .query({ page: '3', limit: '50' })
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.page).toBe(3);
      expect(res.body.data.pagination.limit).toBe(50);
    });

    it('returns 400 when limit exceeds the max of 100', async () => {
      const { owner, project } = await setupProjectWithOwner();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}/tasks`)
        .query({ limit: '500' })
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid sortOrder value', async () => {
      const { owner, project } = await setupProjectWithOwner();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}/tasks`)
        .query({ sortBy: 'dueDate', sortOrder: 'upward' })
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(400);
    });

    it('returns 400 for an unknown query parameter', async () => {
      const { owner, project } = await setupProjectWithOwner();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}/tasks`)
        .query({ unknownParam: 'value' })
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(400);
    });

    it('applies a valid status filter', async () => {
      const { owner, project } = await setupProjectWithOwner();
      await createTask(owner.accessToken, project.id, { status: 'done' });
      await createTask(owner.accessToken, project.id, { status: 'todo' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}/tasks`)
        .query({ status: 'done' })
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks).toHaveLength(1);
      expect(res.body.data.tasks[0].status).toBe('done');
    });

    it('sorts by dueDate in descending order', async () => {
      const { owner, project } = await setupProjectWithOwner();
      await createTask(owner.accessToken, project.id, {
        title: 'Earlier',
        dueDate: '2026-08-01T00:00:00.000Z',
      });
      await createTask(owner.accessToken, project.id, {
        title: 'Later',
        dueDate: '2026-09-01T00:00:00.000Z',
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}/tasks`)
        .query({ sortBy: 'dueDate', sortOrder: 'desc' })
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks[0].title).toBe('Later');
      expect(res.body.data.tasks[1].title).toBe('Earlier');
    });
  });

  describe('GET /api/v1/projects/:projectId/tasks/:taskId', () => {
    it('returns 401 with no access token', async () => {
      const { owner, project } = await setupProjectWithOwner();
      const task = await createTask(owner.accessToken, project.id);

      const res = await request(app.getHttpServer()).get(
        `/api/v1/projects/${project.id}/tasks/${task.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('returns 404 when the task does not exist in this project', async () => {
      const { owner, project } = await setupProjectWithOwner();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}/tasks/${randomUUID()}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('returns a task with a valid access token', async () => {
      const { owner, project } = await setupProjectWithOwner();
      const task = await createTask(owner.accessToken, project.id);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}/tasks/${task.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.task.id).toBe(task.id);
    });
  });

  describe('PATCH /api/v1/projects/:projectId/tasks/:taskId', () => {
    it('returns 400 when the body is empty', async () => {
      const { owner, project } = await setupProjectWithOwner();
      const task = await createTask(owner.accessToken, project.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${project.id}/tasks/${task.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 when the task does not exist in this project', async () => {
      const { owner, project } = await setupProjectWithOwner();

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${project.id}/tasks/${randomUUID()}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ status: 'done' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when reassigning to a non-member', async () => {
      const { owner, project } = await setupProjectWithOwner();
      const task = await createTask(owner.accessToken, project.id);
      const outsider = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${project.id}/tasks/${task.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ assigneeId: outsider.id });

      expect(res.status).toBe(400);
    });

    it('clears the assignee when assigneeId is explicitly null', async () => {
      const { owner, workspace, project } = await setupProjectWithOwner();
      const member = await signupTestUser(app);
      await addMember(owner.accessToken, workspace.id, member);
      const task = await createTask(owner.accessToken, project.id, {
        assigneeId: member.id,
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${project.id}/tasks/${task.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ assigneeId: null });

      expect(res.status).toBe(200);
      expect(res.body.data.task.assigneeId).toBeNull();
    });

    it('updates the task with a valid access token', async () => {
      const { owner, project } = await setupProjectWithOwner();
      const task = await createTask(owner.accessToken, project.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${project.id}/tasks/${task.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ status: 'done' });

      expect(res.status).toBe(200);
      expect(res.body.data.task.status).toBe('done');
    });
  });

  describe('DELETE /api/v1/projects/:projectId/tasks/:taskId', () => {
    it('returns 401 with no access token', async () => {
      const { owner, project } = await setupProjectWithOwner();
      const task = await createTask(owner.accessToken, project.id);

      const res = await request(app.getHttpServer()).delete(
        `/api/v1/projects/${project.id}/tasks/${task.id}`,
      );

      expect(res.status).toBe(401);
    });

    it('returns 404 when the task does not exist in this project', async () => {
      const { owner, project } = await setupProjectWithOwner();

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${project.id}/tasks/${randomUUID()}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('deletes the task with a valid access token, and it becomes unreachable after', async () => {
      const { owner, project } = await setupProjectWithOwner();
      const task = await createTask(owner.accessToken, project.id);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${project.id}/tasks/${task.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.status).toBe('success');

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}/tasks/${task.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`);

      expect(getRes.status).toBe(404);
    });
  });
});
