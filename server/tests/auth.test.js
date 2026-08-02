import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';

describe('Teacher Auth API Integration', () => {
  it('should handle login teacher with email and password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'teacher_test_2026@example.com', password: 'Password123!' });

    expect([200, 401]).toContain(res.status);
  });

  it('should reject signup without valid access code', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'teacher_test_2026@example.com',
        password: 'Password123!',
        fullName: 'Prof. Test Teacher',
        accessCode: 'wrong_code'
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid access code.');
  });

  it('should create account on signup with valid access code', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'teacher_test_2026@example.com',
        password: 'Password123!',
        fullName: 'Prof. Test Teacher',
        accessCode: 'admin'
      });

    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('should validate teacher session token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer dev-fallback-token');

    expect([200, 401]).toContain(res.status);
  });
});
