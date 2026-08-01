import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';

describe('Teacher Auth API Integration', () => {
  it('should support legacy APP_PASSWORD login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ appPassword: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('should handle signup request gracefully in dev mode', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'testteacher@school.edu',
        password: 'password123',
        fullName: 'Prof. Test Teacher'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should validate teacher session token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer dev-fallback-token');

    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
  });
});
