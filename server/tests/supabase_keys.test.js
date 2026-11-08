import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getPublishableKey,
  getSecretKey,
  getKeyType,
} from '../services/supabaseClient';

describe('Supabase API Keys Modernization Contract', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Publishable Key resolution', () => {
    it('should prioritize modern SUPABASE_PUBLISHABLE_KEY over legacy SUPABASE_ANON_KEY', () => {
      process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_modern_key_123';
      process.env.SUPABASE_ANON_KEY = 'eyJ_legacy_anon_jwt';

      expect(getPublishableKey()).toBe('sb_publishable_modern_key_123');
    });

    it('should fall back to VITE_SUPABASE_PUBLISHABLE_KEY if SUPABASE_PUBLISHABLE_KEY is not set', () => {
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vite_key_456';
      process.env.SUPABASE_ANON_KEY = 'eyJ_legacy_anon_jwt';

      expect(getPublishableKey()).toBe('sb_publishable_vite_key_456');
    });

    it('should fall back to legacy SUPABASE_ANON_KEY when modern keys are absent', () => {
      process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy';

      expect(getPublishableKey()).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legacy');
    });

    it('should ignore placeholder values for publishable key', () => {
      process.env.SUPABASE_PUBLISHABLE_KEY = 'your_supabase_publishable_key_here';
      process.env.SUPABASE_ANON_KEY = 'your_supabase_anon_key_here';

      expect(getPublishableKey()).toBe('');
    });
  });

  describe('Secret Key resolution', () => {
    it('should prioritize modern SUPABASE_SECRET_KEY over legacy SUPABASE_SERVICE_ROLE_KEY', () => {
      process.env.SUPABASE_SECRET_KEY = 'sb_secret_modern_key_789';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJ_legacy_service_jwt';

      expect(getSecretKey()).toBe('sb_secret_modern_key_789');
    });

    it('should fall back to legacy SUPABASE_SERVICE_ROLE_KEY when modern key is absent', () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service';

      expect(getSecretKey()).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service');
    });

    it('should ignore placeholder values for secret key and fall back to valid publishable key', () => {
      process.env.SUPABASE_SECRET_KEY = 'your_supabase_secret_key_here';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'your-supabase-service-role';
      process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fallback';

      expect(getSecretKey()).toBe('sb_publishable_fallback');
    });
  });

  describe('Key Type Classification', () => {
    it('should identify modern publishable keys', () => {
      expect(getKeyType('sb_publishable_abc123')).toBe('publishable');
      expect(getKeyType('sbp_abc123')).toBe('publishable');
    });

    it('should identify modern secret keys', () => {
      expect(getKeyType('sb_secret_xyz789')).toBe('secret');
      expect(getKeyType('sbs_xyz789')).toBe('secret');
    });

    it('should identify legacy JWT keys', () => {
      expect(getKeyType('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig')).toBe('legacy_jwt');
    });

    it('should return unknown for empty or unrecognized formats', () => {
      expect(getKeyType('')).toBe('unknown');
      expect(getKeyType(null)).toBe('unknown');
      expect(getKeyType('some_random_key')).toBe('unknown');
    });
  });
});
