const { supabase, isConfigured } = require('./supabaseClient');

const APP_PASSWORD = process.env.APP_PASSWORD || 'admin';

/**
 * Secure Teacher Authorization verification helper.
 * Validates request header against secret APP_PASSWORD or Supabase JWT token.
 * Fallback tokens are strictly rejected in production when Supabase is configured.
 */
async function verifyTeacherAuth(req) {
  const headerPass = req.headers['x-app-password'] || req.headers['authorization'] || '';
  if (!headerPass) return false;

  const cleanHeader = headerPass.replace(/^Bearer\s+/i, '').trim();
  if (!cleanHeader) return false;

  // 1. Direct match with secret APP_PASSWORD (always allowed if provided by admin)
  if (cleanHeader === APP_PASSWORD) {
    return true;
  }

  // 2. Placeholder dev/legacy tokens are ONLY permitted when Supabase is UNCONFIGURED (local dev mode)
  if (!isConfigured()) {
    if (cleanHeader === 'legacy-app-password-token' || cleanHeader === 'dev-fallback-token') {
      return true;
    }
  }

  // 3. Validate Supabase Auth JWT token in live production mode
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

module.exports = { verifyTeacherAuth, APP_PASSWORD };
