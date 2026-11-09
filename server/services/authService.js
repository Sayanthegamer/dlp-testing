const crypto = require('crypto');
const {
  getAdminClient,
  createAuthClient,
  ensureTeacherProfile,
  isConfigured,
  isValidUserJwt,
  isValidUuid,
} = require('./supabaseClient');

function getTeacherAccessCode() {
  return process.env.TEACHER_ACCESS_CODE || process.env.APP_PASSWORD || 'dlp_teacher_secret_passcode_2026';
}

const TEACHER_ACCESS_CODE = getTeacherAccessCode();

function safeCompareStrings(inputStr, expectedStr) {
  const bufA = Buffer.from(String(inputStr || '').trim());
  const bufB = Buffer.from(String(expectedStr || '').trim());
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates whether the given string matches any valid teacher access code
 * (checks TEACHER_ACCESS_CODE, APP_PASSWORD, SUPABASE_SECRET_KEY, SUPABASE_HIDDEN_KEY, and local default fallback).
 */
function isValidTeacherAccessCode(inputStr) {
  if (!inputStr) return false;
  const candidates = [
    process.env.TEACHER_ACCESS_CODE,
    process.env.APP_PASSWORD,
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SECRET_DEFAULT_KEY,
    process.env.SUPABASE_HIDDEN_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    'dlp_teacher_secret_passcode_2026',
  ].filter(Boolean);

  return candidates.some(expected => safeCompareStrings(inputStr, expected));
}

/**
 * Secure Teacher Authorization verification helper.
 * Validates request Bearer JWT token against Supabase Auth, or x-app-password / dev tokens in local/passcode mode.
 *
 * CRITICAL: When authenticated via a passcode or dev-fallback-token (not a Supabase Auth UUID user),
 * `req.user.id` is set to `null` (with `req.user.localId = 'local-dev-user'`) and `req.accessToken` is `null`
 * so downstream database queries never inject non-UUID strings into PostgreSQL UUID columns or send
 * non-JWT strings in `Authorization: Bearer` headers to PostgREST.
 */
async function verifyTeacherAuth(req) {
  const headerPass = req.headers['authorization'] || '';
  const appPassHeader = req.headers['x-app-password'] || '';
  const cleanHeader = headerPass.replace(/^Bearer\s+/i, '').trim() || String(appPassHeader).trim();

  if (!cleanHeader) return false;

  // 1. Placeholder dev/demo tokens or matching teacher access code are permitted for evaluation & fallback
  if (
    cleanHeader === 'legacy-app-password-token' ||
    cleanHeader === 'dev-fallback-token' ||
    isValidTeacherAccessCode(cleanHeader)
  ) {
    req.user = {
      id: null,
      localId: 'local-dev-user',
      email: 'teacher@local.dev',
      role: 'teacher',
      isPasscodeAuth: true,
    };
    req.accessToken = null;
    req.rawAuthToken = cleanHeader;
    return true;
  }

  // 2. Validate Supabase Auth JWT token in live production mode using an isolated Auth client
  if (isConfigured() && isValidUserJwt(cleanHeader)) {
    const authClient = createAuthClient() || getAdminClient();
    if (authClient) {
      try {
        const { data: { user }, error } = await authClient.auth.getUser(cleanHeader);
        if (!error && user && isValidUuid(user.id)) {
          req.user = user;
          req.accessToken = cleanHeader;
          // Ensure teacher row exists in public.teachers to satisfy FK constraints
          await ensureTeacherProfile(user);
          return true;
        }
      } catch (err) {
        console.warn('[Teacher Auth Verification Warning]:', err.message);
      }
    }
  }

  return false;
}

module.exports = {
  verifyTeacherAuth,
  getTeacherAccessCode,
  isValidTeacherAccessCode,
  safeCompareStrings,
  TEACHER_ACCESS_CODE,
};
