const express = require('express');
const router = express.Router();
const { supabase, isConfigured } = require('../services/supabaseClient');

// Password fallback check if Supabase env keys are placeholders
const APP_PASSWORD = process.env.APP_PASSWORD || 'admin';

/**
 * POST /api/auth/signup
 * Register a new teacher account in Supabase Auth
 */
router.post('/signup', async (req, res) => {
  const { email, password, fullName } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
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

    return res.json({
      success: true,
      user: data.user,
      session: data.session,
    });
  } catch (err) {
    console.error('[Auth Signup Error]:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 * Log in teacher via Supabase Auth or APP_PASSWORD fallback
 */
router.post('/login', async (req, res) => {
  const { email, password, appPassword } = req.body || {};

  // Support legacy single password login
  if (appPassword && appPassword === APP_PASSWORD) {
    return res.json({
      success: true,
      mode: 'legacy_password',
      teacher: { email: 'teacher@local.dev', fullName: 'Tuition Teacher' },
      token: 'legacy-app-password-token',
    });
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (!isConfigured()) {
    if (password === APP_PASSWORD || password === 'admin') {
      return res.json({
        success: true,
        mode: 'dev_fallback',
        teacher: { email, fullName: email.split('@')[0] },
        token: 'dev-fallback-token',
      });
    }
    return res.status(401).json({ error: 'Invalid password or unconfigured Supabase credentials.' });
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
    console.error('[Auth Login Error]:', err.message);
    return res.status(401).json({ error: err.message });
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
    return res.status(401).json({ authenticated: false, error: err.message });
  }
});

module.exports = router;
