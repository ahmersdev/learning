import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
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
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send(validSignupBody);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user).toEqual({
        fullName: validSignupBody.fullName,
        username: validSignupBody.username,
        email: validSignupBody.email,
      });
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
  });

  describe('POST /api/v1/auth/signin', () => {
    it('logs in with email and returns 200 with accessToken + refreshToken cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ email: 'john@example.com', password: 'Password1!' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
    });

    it('logs in with username and returns 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ username: 'johndoe', password: 'Password1!' });

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
        .send({ email: 'john@example.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 401 when no refresh token cookie is present', async () => {
      const res = await request(app.getHttpServer()).post(
        '/api/v1/auth/refresh',
      );

      expect(res.status).toBe(401);
    });

    it('returns a new accessToken when a valid refresh cookie is present', async () => {
      const signinRes = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ email: 'john@example.com', password: 'Password1!' });

      const cookie = signinRes.headers['set-cookie'][0];

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
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
      const res = await request(app.getHttpServer()).post(
        '/api/v1/auth/signout',
      );

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=;/);
    });
  });
});
