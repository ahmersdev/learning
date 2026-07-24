import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';

export interface TestUser {
  accessToken: string;
  refreshTokenCookie: string;
  email: string;
  username: string;
}

export async function signupTestUser(
  app: INestApplication<App>,
): Promise<TestUser> {
  const unique = randomUUID().slice(0, 8);
  const email = `test-${unique}@example.com`;
  const username = `testuser${unique}`;

  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/signup')
    .send({
      fullName: 'Test User',
      username,
      email,
      password: 'Password1!',
    });

  return {
    accessToken: res.body.data.accessToken,
    refreshTokenCookie: res.headers['set-cookie'][0],
    email,
    username,
  };
}
