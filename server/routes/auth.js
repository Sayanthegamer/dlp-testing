const express = require('express');
const router = express.Router();
const { supabase, isConfigured } = require('../services/supabaseClient');
const { getTeacherAccessCode, isValidTeacherAccessCode, safeCompareStrings } = require('../services/authService');

/**
 * POST /api/auth/signup
 * Register a new teacher account in Supabase Auth (requires accessCode)
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

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName || '' },
      },
    });

    if (error) throw error;

    if (data.user) {
      await supabase.from('teachers').upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName || data.user.email.split('@')[0],
      });
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
 * Log in teacher via Supabase Auth (email + password)
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

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

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

  if (token === 'legacy-app-password-token' || token === 'dev-fallback-token') {
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
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw error || new Error('Invalid user session');

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

  if (!isConfigured()) {
    return res.json({
      success: true,
      token: 'dev-fallback-token',
      refresh_token: 'dev-refresh-token',
    });
  }

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    if (error) throw error;

    if (!data.session) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
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
