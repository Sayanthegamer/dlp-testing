const express = require('express');
const router = express.Router();
const {
  getAdminClient,
  createAuthClient,
   createUserClient,
  ensureTeacherProfile,
  isConfigured,
  isValidUserJwt,
} = require('../services/supabaseClient');
const { isValidTeacherAccessCode, safeCompareStrings } = require('../services/authService');

/**
 * POST /api/auth/signup
 * Register a new teacher account in Supabase Auth (requires accessCode).
 * Uses a disposable Auth client so the singleton admin client is never polluted with user session state.
 */
router.post('/signup', async (req, res) => {
  const { email, password, fullName, accessCode } = req.body || {};

  if (!email || !password || !accessCode) {
    return res.status(400).json({ error: 'Email, password, and access code are required.' });
  }

  if (!isValidTeacherAccessCode(accessCode)) {
    return res.status(401).json({ error: 'Invalid access code.' });
  }

  if (!isConfigured()) {
    return res.json({
      success: true,
      message: 'Running in dev fallback mode. Account created.',
      teacher: { email, fullName: fullName || email.split('@')[0] },
      token: 'dev-fallback-token',
    });
  }

  const authClient = createAuthClient() || getAdminClient();
  if (!authClient) {
    return res.status(500).json({ error: 'Supabase authentication client is not available.' });
  }

  try {
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = fullName ? String(fullName).trim() : cleanEmail.split('@')[0];

    const { data, error } = await authClient.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: cleanName },
      },
    });

    if (error) throw error;

    if (data?.user) {
      const userClient = data.session?.access_token
        ? createUserClient(data.session.access_token)
        : null;
      await ensureTeacherProfile(
        {
          ...data.user,
          fullName: cleanName,
        },
        userClient
      );
    }

    const requiresConfirmation = !data.session;

    return res.json({
      success: true,
      message: requiresConfirmation
        ? 'Account created. Please check your email for a confirmation link before logging in.'
        : 'Account created.',
      requiresConfirmation,
      user: data.user,
      session: data.session,
      token: data.session?.access_token || null,
      refresh_token: data.session?.refresh_token || null,
    });
  } catch (err) {
    console.error('[Auth Signup Error]:', err.message || err);
    let errorMsg = err.message || 'Signup failed due to an unknown error.';
    if (typeof errorMsg === 'object' || errorMsg === '{}' || errorMsg === '[object Object]') {
      errorMsg = 'Registration failed. Please check your inputs or try again later.';
    }
    return res.status(400).json({ error: errorMsg });
  }
});

/**
 * POST /api/auth/login (and alias POST /api/auth/teacher-login)
 * Log in teacher via Supabase Auth (email + password).
 * Uses a disposable Auth client and syncs the teacher profile into `public.teachers`.
 */
async function handleTeacherLogin(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (!isConfigured()) {
    if (
      isValidTeacherAccessCode(password) ||
      safeCompareStrings(password, 'teacher123') ||
      safeCompareStrings(password, 'admin')
    ) {
      return res.json({
        success: true,
        mode: 'dev_fallback',
        teacher: { email, fullName: email.split('@')[0] },
        token: 'dev-fallback-token',
      });
    }
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const authClient = createAuthClient() || getAdminClient();
  if (!authClient) {
    return res.status(500).json({ error: 'Supabase authentication client is not available.' });
  }

  try {
    const cleanEmail = String(email).trim().toLowerCase();
    const { data, error } = await authClient.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) throw error;

    // Ensure the authenticated teacher exists in public.teachers so foreign keys never fail
    if (data?.user) {
      const userClient = data.session?.access_token
        ? createUserClient(data.session.access_token)
        : null;
      await ensureTeacherProfile(data.user, userClient);
    }

    return res.json({
      success: true,
      user: data.user,
      session: data.session,
      token: data.session?.access_token,
      refresh_token: data.session?.refresh_token || null,
    });
  } catch (err) {
    console.error('[Auth Login Error]:', err.message || err);
    let errorMsg = err.message || 'Login failed due to an unknown error.';
    if (typeof errorMsg === 'object' || errorMsg === '{}' || errorMsg === '[object Object]') {
      errorMsg = 'Login failed. Please check your credentials.';
    }
    return res.status(401).json({ error: errorMsg });
  }
}

router.post('/login', handleTeacherLogin);
router.post('/teacher-login', handleTeacherLogin);

/**
 * GET /api/auth/me
 * Validate session token and return teacher profile
 */
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({ authenticated: false, error: 'No auth token provided' });
  }

  if (
    token === 'legacy-app-password-token' ||
    token === 'dev-fallback-token' ||
    isValidTeacherAccessCode(token)
  ) {
    return res.json({
      authenticated: true,
      mode: 'fallback',
      teacher: { email: 'teacher@local.dev', fullName: 'Instructor' },
    });
  }

  if (!isConfigured()) {
    return res.json({
      authenticated: true,
      mode: 'dev_fallback',
      teacher: { email: 'teacher@local.dev', fullName: 'Instructor' },
    });
  }

  try {
    if (!isValidUserJwt(token)) {
      return res.status(401).json({ authenticated: false, error: 'Invalid user session token format.' });
    }

    const authClient = createAuthClient() || getAdminClient();
    const { data: { user }, error } = await authClient.auth.getUser(token);
    if (error || !user) throw error || new Error('Invalid user session');

    await ensureTeacherProfile(user, createUserClient(token));

    return res.json({
      authenticated: true,
      user,
    });
  } catch (err) {
    let errorMsg = err.message || 'Session validation failed.';
    if (typeof errorMsg === 'object' || errorMsg === '{}' || errorMsg === '[object Object]') {
      errorMsg = 'Invalid user session.';
    }
    return res.status(401).json({ authenticated: false, error: errorMsg });
  }
});

/**
 * POST /api/auth/refresh
 * Exchange a refresh_token for a new access_token + refresh_token pair
 */
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body || {};

  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token is required.' });
  }

  if (!isConfigured() || refresh_token === 'dev-refresh-token') {
    return res.json({
      success: true,
      token: 'dev-fallback-token',
      refresh_token: 'dev-refresh-token',
    });
  }

  try {
    const authClient = createAuthClient() || getAdminClient();
    const { data, error } = await authClient.auth.refreshSession({ refresh_token });

    if (error) throw error;

    if (!data.session) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    if (data.user) {
      await ensureTeacherProfile(data.user, createUserClient(data.session.access_token));
    }

    return res.json({
      success: true,
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    console.error('[Auth Refresh Error]:', err.message || err);
    return res.status(401).json({ error: 'Unable to refresh session. Please log in again.' });
  }
});

module.exports = router;
