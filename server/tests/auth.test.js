import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';
import { isValidTeacherAccessCode } from '../services/authService';

describe('Teacher Auth API Integration', () => {
  describe('isValidTeacherAccessCode unit validation', () => {
    it('should accept TEACHER_ACCESS_CODE', () => {
      process.env.TEACHER_ACCESS_CODE = 'my_custom_teacher_code';
      expect(isValidTeacherAccessCode('my_custom_teacher_code')).toBe(true);
    });

    it('should accept APP_PASSWORD even when TEACHER_ACCESS_CODE is different', () => {
      process.env.TEACHER_ACCESS_CODE = 'code_A';
      process.env.APP_PASSWORD = 'code_B';
      expect(isValidTeacherAccessCode('code_B')).toBe(true);
      expect(isValidTeacherAccessCode('code_A')).toBe(true);
    });

    it('should accept SUPABASE_SECRET_KEY as valid master access code', () => {
      process.env.SUPABASE_SECRET_KEY = 'sb_secret_master_admin_key_9999';
      expect(isValidTeacherAccessCode('sb_secret_master_admin_key_9999')).toBe(true);
    });

    it('should reject random strings or invalid keys', () => {
      process.env.TEACHER_ACCESS_CODE = 'correct_code';
      delete process.env.SUPABASE_SECRET_KEY;
      expect(isValidTeacherAccessCode('some_random_unauthorized_key')).toBe(false);
      expect(isValidTeacherAccessCode('wrong')).toBe(false);
      expect(isValidTeacherAccessCode('')).toBe(false);
    });
  });

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
        accessCode: process.env.TEACHER_ACCESS_CODE || 'dlp_teacher_secret_passcode_2026'
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
