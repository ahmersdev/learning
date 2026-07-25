import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/create-test-app';
import { signupTestUser } from './utils/auth-helper';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const validSignupBody = {
    fullName: 'John Doe',
    username: 'johndoe',
    email: 'john@example.com',
    password: 'Password1!',
  };

  describe('POST /api/v1/auth/signup', () => {
    it('registers a user and returns 201 with accessToken + refreshToken cookie', async () => {
      const uniqueBody = {
        ...validSignupBody,
        email: `signup-${Date.now()}@example.com`,
        username: `signupuser${Date.now()}`,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send(uniqueBody);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user).toEqual(
        expect.objectContaining({
          fullName: uniqueBody.fullName,
          username: uniqueBody.username,
          email: uniqueBody.email,
          role: 'user',
          mustChangePassword: false,
        }),
      );
      expect(res.body.data.user.id).toEqual(expect.any(String));
      expect(res.body.data.user.lastLogin).toEqual(expect.any(String));
      expect(res.body.data.user).not.toHaveProperty('password');
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
    });

    it('returns 400 when fullName is missing', async () => {
      const { fullName, ...body } = validSignupBody;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send(body);

      expect(res.status).toBe(400);
    });

    it('returns 400 when password fails complexity rules', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ ...validSignupBody, password: 'weak' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when an unknown field is included (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ ...validSignupBody, isAdmin: true });

      expect(res.status).toBe(400);
    });

    it('returns 409 when signing up with an email that already exists', async () => {
      const user = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          fullName: 'Someone Else',
          username: `dup${Date.now()}`,
          email: user.email,
          password: 'Password1!',
        });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/v1/auth/signin', () => {
    it('logs in with email and returns 200 with accessToken + refreshToken cookie', async () => {
      const user = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ email: user.email, password: 'Password1!' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
    });

    it('logs in with username and returns 200', async () => {
      const user = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ username: user.username, password: 'Password1!' });

      expect(res.status).toBe(200);
    });

    it('returns 400 when neither username nor email is provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ password: 'Password1!' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when password is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ email: 'someone@example.com' });

      expect(res.status).toBe(400);
    });

    it('returns 401 for a correct email with the wrong password', async () => {
      const user = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ email: user.email, password: 'WrongPassword1!' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 401 when no refresh token cookie is present', async () => {
      const res = await request(app.getHttpServer()).post(
        '/api/v1/auth/refresh',
      );

      expect(res.status).toBe(401);
    });

    it('returns a new accessToken and rotates the refreshToken cookie', async () => {
      const user = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', user.refreshTokenCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
      expect(res.headers['set-cookie'][0]).not.toBe(user.refreshTokenCookie);
    });

    it('rejects reuse of a refresh token cookie after it has been rotated', async () => {
      const user = await signupTestUser(app);

      const firstRefresh = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', user.refreshTokenCookie);
      expect(firstRefresh.status).toBe(200);

      const reuseAttempt = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', user.refreshTokenCookie);

      expect(reuseAttempt.status).toBe(401);
    });

    it('returns 401 for a malformed refresh token cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=not-a-real-jwt');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/signout', () => {
    it('clears the refreshToken cookie and returns 200', async () => {
      const user = await signupTestUser(app);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signout')
        .set('Cookie', user.refreshTokenCookie);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=;/);
    });

    it('revokes the session so the refresh token no longer works after signout', async () => {
      const user = await signupTestUser(app);

      await request(app.getHttpServer())
        .post('/api/v1/auth/signout')
        .set('Cookie', user.refreshTokenCookie);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', user.refreshTokenCookie);

      expect(res.status).toBe(401);
    });

    it('returns 200 even when no refresh token cookie is present', async () => {
      const res = await request(app.getHttpServer()).post(
        '/api/v1/auth/signout',
      );

      expect(res.status).toBe(200);
    });
  });
});
