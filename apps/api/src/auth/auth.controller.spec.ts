import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController session cookie and rate limiting', () => {
  let app: INestApplication;
  const absoluteExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const authService = {
    login: jest.fn().mockResolvedValue({
      user: {
        userId: 'user-1',
        email: 'customer@example.com',
        role: 'CUSTOMER',
      },
      accessToken: 'access-token',
      refreshToken: 'secret-refresh-token',
      session: {
        idleExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        absoluteExpiresAt,
      },
    }),
  };

  beforeAll(async () => {
    process.env.FRONTEND_URL = 'http://localhost:3000';
    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps refresh tokens out of JSON and returns 429 after five login attempts', async () => {
    const login = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({ email: 'customer@example.com', password: 'Password123!' });

    const first = await login().expect(200);
    expect(first.body).toEqual(
      expect.objectContaining({ accessToken: 'access-token' }),
    );
    expect(first.body).not.toHaveProperty('refreshToken');
    expect(first.headers['set-cookie']?.[0]).toContain('voucher_refresh=');
    expect(first.headers['set-cookie']?.[0]).toContain('HttpOnly');

    await login().expect(200);
    await login().expect(200);
    await login().expect(200);
    await login().expect(200);
    await login().expect(429);
  });
});
