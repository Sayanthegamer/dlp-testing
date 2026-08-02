const { supabase, isConfigured } = require('./supabaseClient');

const TEACHER_ACCESS_CODE = process.env.TEACHER_ACCESS_CODE || process.env.APP_PASSWORD || 'admin';

/**
 * Secure Teacher Authorization verification helper.
 * Validates request Bearer JWT token against Supabase Auth.
 * Fallback tokens are strictly rejected in production when Supabase is configured.
 */
async function verifyTeacherAuth(req) {
  const headerPass = req.headers['authorization'] || '';
  if (!headerPass) return false;

  const cleanHeader = headerPass.replace(/^Bearer\s+/i, '').trim();
  if (!cleanHeader) return false;

  // 1. Placeholder dev tokens are ONLY permitted when Supabase is UNCONFIGURED (local dev mode)
  if (!isConfigured()) {
    if (cleanHeader === 'legacy-app-password-token' || cleanHeader === 'dev-fallback-token') {
      return true;
    }
  }

  // 2. Validate Supabase Auth JWT token in live production mode
  if (isConfigured() && supabase) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(cleanHeader);
      if (!error && user) {
        return true;
      }
    } catch (err) {
      console.warn('[Teacher Auth Verification Warning]:', err.message);
    }
  }

  return false;
}

module.exports = { verifyTeacherAuth, TEACHER_ACCESS_CODE };
