const express = require('express');
const router = express.Router();
const { supabase, isConfigured } = require('../services/supabaseClient');

// Teacher access code for account creation gate & dev mode fallback
const TEACHER_ACCESS_CODE = process.env.TEACHER_ACCESS_CODE || process.env.APP_PASSWORD || 'admin';

/**
 * POST /api/auth/signup
 * Register a new teacher account in Supabase Auth (requires accessCode)
 */
router.post('/signup', async (req, res) => {
  const { email, password, fullName, accessCode } = req.body || {};

  if (!email || !password || !accessCode) {
    return res.status(400).json({ error: 'Email, password, and access code are required.' });
  }

  if (accessCode.trim() !== TEACHER_ACCESS_CODE.trim()) {
    return res.status(401).json({ error: 'Invalid access code.' });
  }

  if (!isConfigured()) {
    // Fallback mode if Supabase credentials are not populated in .env yet
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

    // Create entry in teachers table
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
        ? 'Account created! Please check your email for a confirmation link before logging in.'
        : 'Account created successfully.',
      requiresConfirmation,
      user: data.user,
      session: data.session,
      token: data.session?.access_token || null,
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
 * POST /api/auth/login
 * Log in teacher via Supabase Auth (email + password only)
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (!isConfigured()) {
    if (password.trim() === TEACHER_ACCESS_CODE.trim()) {
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
    });
  } catch (err) {
    console.error('[Auth Login Error]:', err.message || err);
    let errorMsg = err.message || 'Login failed due to an unknown error.';
    if (typeof errorMsg === 'object' || errorMsg === '{}' || errorMsg === '[object Object]') {
      errorMsg = 'Login failed. Please check your credentials.';
    }
    return res.status(401).json({ error: errorMsg });
  }
});

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
      teacher: { email: 'teacher@local.dev', fullName: 'Tuition Teacher' },
    });
  }

  if (!isConfigured()) {
    return res.json({
      authenticated: true,
      mode: 'dev_fallback',
      teacher: { email: 'teacher@local.dev', fullName: 'Tuition Teacher' },
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

module.exports = router;
