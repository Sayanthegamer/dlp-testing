const crypto = require('crypto');
const {
  getAdminClient,
  createAuthClient,
  ensureTeacherProfile,
  isConfigured,
  isValidUserJwt,
  isValidUuid,
} = require('./supabaseClient');

/**
 * Determines whether demo/fallback authentication tokens and default passcodes are permitted.
 * Strictly disabled in production unless ALLOW_DEMO_AUTH=true is explicitly set.
 */
function isDemoOrFallbackAllowed() {
  if (process.env.ALLOW_DEMO_AUTH === 'true') return true;
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL_ENV === 'production'
  ) {
    return false;
  }
  return true;
}

function getTeacherAccessCode() {
  const configured = process.env.TEACHER_ACCESS_CODE || process.env.APP_PASSWORD;
  if (configured) return configured;
  return isDemoOrFallbackAllowed() ? 'dlp_teacher_secret_passcode_2026' : '';
}

const TEACHER_ACCESS_CODE = getTeacherAccessCode();

function safeCompareStrings(inputStr, expectedStr) {
  const bufA = Buffer.from(String(inputStr || '').trim());
  const bufB = Buffer.from(String(expectedStr || '').trim());
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validates whether the given string matches a configured teacher access code.
 * Security invariant: Database secret keys (SUPABASE_SECRET_KEY / SERVICE_ROLE_KEY)
 * are NEVER accepted as user/teacher access codes, and hardcoded demo passcodes
 * are rejected in production.
 */
function isValidTeacherAccessCode(inputStr) {
  if (!inputStr) return false;

  // Never allow Supabase database secret keys to double as teacher access codes
  const dbSecrets = [
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SECRET_DEFAULT_KEY,
    process.env.SUPABASE_HIDDEN_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter(Boolean);

  if (dbSecrets.some((secret) => safeCompareStrings(inputStr, secret))) {
    return false;
  }

  const candidates = [
    process.env.TEACHER_ACCESS_CODE,
    process.env.APP_PASSWORD,
  ].filter(Boolean);

  if (candidates.length === 0 && isDemoOrFallbackAllowed()) {
    candidates.push('dlp_teacher_secret_passcode_2026');
  }

  return candidates.some((expected) => safeCompareStrings(inputStr, expected));
}

/**
 * Secure Teacher Authorization verification helper.
 * In production, requires a verified Supabase Auth JWT (`user.id` UUID).
 * Demo/passcode tokens are strictly isolated to non-production or explicit ALLOW_DEMO_AUTH environments.
 */
async function verifyTeacherAuth(req) {
  const headerPass = req.headers['authorization'] || '';
  const appPassHeader = req.headers['x-app-password'] || '';
  const cleanHeader = headerPass.replace(/^Bearer\s+/i, '').trim() || String(appPassHeader).trim();

  if (!cleanHeader) return false;

  // 1. Validate Supabase Auth JWT token first when Supabase is configured
  if (isConfigured() && isValidUserJwt(cleanHeader)) {
    const authClient = createAuthClient() || getAdminClient();
    if (authClient) {
      try {
        const {
          data: { user },
          error,
        } = await authClient.auth.getUser(cleanHeader);
        if (!error && user && isValidUuid(user.id)) {
          req.user = user;
          req.accessToken = cleanHeader;
          await ensureTeacherProfile(user);
          return true;
        }
      } catch (err) {
        console.warn('[Teacher Auth Verification Warning]:', err.message);
      }
    }
    return false;
  }

  // 2. Permit demo/fallback tokens ONLY when demo auth is allowed (non-production)
  if (
    isDemoOrFallbackAllowed() &&
    (cleanHeader === 'legacy-app-password-token' ||
      cleanHeader === 'dev-fallback-token' ||
      isValidTeacherAccessCode(cleanHeader))
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

  return false;
}

module.exports = {
  verifyTeacherAuth,
  getTeacherAccessCode,
  isValidTeacherAccessCode,
  isDemoOrFallbackAllowed,
  safeCompareStrings,
  TEACHER_ACCESS_CODE,
};
