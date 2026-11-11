import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index';
import {
  isValidTeacherAccessCode,
  isDemoOrFallbackAllowed,
  verifyTeacherAuth,
} from '../services/authService';
import { getFilePath } from '../services/localStoreService';

describe('Teacher Auth API Integration & Production Boundary', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.ALLOW_DEMO_AUTH;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

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

    it('should NEVER accept any SUPABASE secret or service_role keys as teacher access code', () => {
      const mockSecret = ['sb', 'secret'].join('_') + '_master_admin_key_9999';
      const mockDefaultSecret = ['sb', 'secret'].join('_') + '_default_key_8888';
      const mockHiddenKey = ['sb', 'secret'].join('_') + '_hidden_key_7777';
      process.env.SUPABASE_SECRET_KEY = mockSecret;
      process.env.SUPABASE_SECRET_DEFAULT_KEY = mockDefaultSecret;
      process.env.SUPABASE_HIDDEN_KEY = mockHiddenKey;
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJ_service_role_secret';
      expect(isValidTeacherAccessCode(mockSecret)).toBe(false);
      expect(isValidTeacherAccessCode(mockDefaultSecret)).toBe(false);
      expect(isValidTeacherAccessCode(mockHiddenKey)).toBe(false);
      expect(isValidTeacherAccessCode('eyJ_service_role_secret')).toBe(false);
    });

    it('should disable demo/fallback auth in production unless ALLOW_DEMO_AUTH=true and reject default passcode', () => {
      delete process.env.TEACHER_ACCESS_CODE;
      delete process.env.APP_PASSWORD;

      process.env.NODE_ENV = 'production';
      expect(isDemoOrFallbackAllowed()).toBe(false);
      expect(isValidTeacherAccessCode('dlp_teacher_secret_passcode_2026')).toBe(false);

      delete process.env.NODE_ENV;
      process.env.VERCEL = '1';
      expect(isDemoOrFallbackAllowed()).toBe(false);

      delete process.env.VERCEL;
      process.env.VERCEL_ENV = 'production';
      expect(isDemoOrFallbackAllowed()).toBe(false);

      process.env.ALLOW_DEMO_AUTH = 'true';
      expect(isDemoOrFallbackAllowed()).toBe(true);
    });

    it('should reject random strings or invalid keys', () => {
      process.env.TEACHER_ACCESS_CODE = 'correct_code';
      delete process.env.SUPABASE_SECRET_KEY;
      expect(isValidTeacherAccessCode('some_random_unauthorized_key')).toBe(false);
      expect(isValidTeacherAccessCode('wrong')).toBe(false);
      expect(isValidTeacherAccessCode('')).toBe(false);
    });
  });

  it('should reject dev-fallback-token and legacy-app-password-token on verifyTeacherAuth, /api/auth/me, and /api/auth/refresh in production', async () => {
    process.env.NODE_ENV = 'production';

    for (const demoToken of ['dev-fallback-token', 'legacy-app-password-token']) {
      const mockReq = {
        headers: { authorization: `Bearer ${demoToken}` },
      };
      expect(await verifyTeacherAuth(mockReq)).toBe(false);

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${demoToken}`);
      expect(meRes.status).toBe(401);

      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: demoToken });
      expect(refreshRes.status).toBe(401);
    }
  });

  it('should throw [Durable Storage Required] from localStoreService.getFilePath() in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => getFilePath('exams.json')).toThrow(/\[Durable Storage Required\]/);
  });

  it('should reject signup without valid access code', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'teacher_test_2026@example.com',
        password: 'Password123!',
        fullName: 'Prof. Test Teacher',
        accessCode: 'wrong_code',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid access code.');
  });

  it('should allow dev-fallback-token in local development/test mode', async () => {
    process.env.NODE_ENV = 'test';
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer dev-fallback-token');

    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
  });
});
