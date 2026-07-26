import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';
import { signupTestUser, TestUser } from './utils/auth-helper';

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let user: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    user = await signupTestUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/users/me', () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/users/me');

      expect(res.status).toBe(401);
    });

    it('returns 401 with a malformed access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer not-a-real-jwt');

      expect(res.status).toBe(401);
    });

    it('returns the user profile with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          fullName: expect.any(String),
          username: user.username,
          email: user.email,
          role: 'admin',
          mustChangePassword: false,
        }),
      );
      expect(res.body.data.user).not.toHaveProperty('password');
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('returns 401 with no access token', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .send({ fullName: 'New Name' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when the body is empty', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when an unknown field is included', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ fullName: 'New Name', isAdmin: true });

      expect(res.status).toBe(400);
    });

    it('updates fullName with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ fullName: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.fullName).toBe('Updated Name');
      expect(res.body.data.user).not.toHaveProperty('password');
    });

    it('returns 409 when updating username to one that already exists', async () => {
      const otherUser = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ username: otherUser.username });

      expect(res.status).toBe(409);
    });
  });
});
