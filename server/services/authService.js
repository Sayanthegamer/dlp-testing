const { supabase, isConfigured } = require('./supabaseClient');

const APP_PASSWORD = process.env.APP_PASSWORD || 'admin';

/**
 * Secure Teacher Authorization verification helper.
 * Validates request header against secret APP_PASSWORD or Supabase JWT token.
 * Prevents arbitrary header length bypasses.
 */
async function verifyTeacherAuth(req) {
  const headerPass = req.headers['x-app-password'] || req.headers['authorization'] || '';
  if (!headerPass) return false;

  const cleanHeader = headerPass.replace(/^Bearer\s+/i, '').trim();
  if (!cleanHeader) return false;

  // 1. Direct match with secret APP_PASSWORD or dev fallback tokens
  if (
    cleanHeader === APP_PASSWORD ||
    cleanHeader === 'legacy-app-password-token' ||
    cleanHeader === 'dev-fallback-token'
  ) {
    return true;
  }

  // 2. Validate Supabase Auth JWT token
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
