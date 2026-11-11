const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const parseRoutes = require('./routes/parse');
const submissionsRoutes = require('./routes/submissions');
const examsRoutes = require('./routes/exams');
const authRoutes = require('./routes/auth');
const studentAuthRoutes = require('./routes/studentAuth');
const { verifyTeacherAuth, isDemoOrFallbackAllowed } = require('./services/authService');
const { isConfigured, getKeyType, getSecretKey } = require('./services/supabaseClient');

/**
 * Shared Express Application Factory (`createApp`)
 * Used identically by `server/index.js` (local/standalone) and `api/index.js` (Vercel serverless)
 * so security headers, CORS, rate limiters, request IDs, and route mounting never diverge.
 */
function createApp() {
  const app = express();

  // Trust Vercel / reverse-proxy X-Forwarded-* headers so express-rate-limit v8
  // keys client IPs cleanly without throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
  app.set('trust proxy', 1);

  // Attach structured request ID for tracing and error logs
  app.use((req, res, next) => {
    const reqId = req.headers['x-request-id'] || `req_${crypto.randomBytes(6).toString('hex')}`;
    req.requestId = reqId;
    res.setHeader('X-Request-Id', reqId);
    next();
  });

  // Security Headers Middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allow KaTeX inline styles and canvas rendering
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // Unified CORS Configuration (explicit env list + dynamic same-origin for custom domains)
  const rawEnvOrigins = [process.env.CLIENT_ORIGIN, process.env.CORS_ORIGINS]
    .filter(Boolean)
    .flatMap((val) => String(val).split(','))
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const vercelHostOrigins = [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]
    .filter(Boolean)
    .map((host) => {
      const cleanHost = String(host).trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      return cleanHost ? `https://${cleanHost}` : '';
    })
    .filter(Boolean);

  const allowedOrigins = Array.from(
    new Set([
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      ...rawEnvOrigins,
      ...vercelHostOrigins,
    ])
  );

  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      if (!origin) {
        return callback(null, { origin: true, credentials: true });
      }

      const normalizedOrigin = origin.replace(/\/+$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, { origin: true, credentials: true });
      }

      // Dynamic same-origin match (supports custom domains on Vercel without requiring CLIENT_ORIGIN)
      try {
        const originUrl = new URL(origin);
        const reqHost = (req.headers['x-forwarded-host'] || req.headers.host || '')
          .split(',')[0]
          .trim()
          .toLowerCase();
        const reqProto = (req.headers['x-forwarded-proto'] || req.protocol || 'http')
          .split(',')[0]
          .trim()
          .toLowerCase();

        if (
          reqHost &&
          originUrl.host.toLowerCase() === reqHost &&
          originUrl.protocol === `${reqProto}:`
        ) {
          return callback(null, { origin: true, credentials: true });
        }
      } catch (_) {}

      const corsErr = new Error('CORS policy: Origin not allowed');
      corsErr.status = 403;
      return callback(corsErr);
    })
  );

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Unified Rate Limiters
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again after 15 minutes.',
    },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
  });

  const parseLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many parsing requests. Please wait a few minutes before trying again.',
    },
  });

  app.use('/api/', globalLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/teacher-login', authLimiter);
  app.use('/api/auth/signup', authLimiter);
  app.use('/api/student/login', authLimiter);
  app.use('/api/student/signup', authLimiter);
  app.use('/api/student-auth/login', authLimiter);
  app.use('/api/student-auth/signup', authLimiter);
  app.use('/api/parse-question', parseLimiter);
  app.use('/api/parse-text', parseLimiter);
  app.use('/api/parse-image', parseLimiter);
  app.use('/api/parse-docx', parseLimiter);

  const authMiddleware = async (req, res, next) => {
    const isAuthorized = await verifyTeacherAuth(req);
    if (isAuthorized) {
      return next();
    }
    return res.status(401).json({
      success: false,
      error: 'Unauthorized teacher access.',
      requestId: req.requestId,
    });
  };

  app.get('/api/health', (req, res) => {
    const hasGemini = !!(
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY.length > 5 &&
      !process.env.GEMINI_API_KEY.includes('your_')
    );
    const hasAnthropic = !!(
      process.env.ANTHROPIC_API_KEY &&
      process.env.ANTHROPIC_API_KEY.length > 5 &&
      !process.env.ANTHROPIC_API_KEY.includes('your_')
    );
    const dbConnected = isConfigured();
    const rawJwt = typeof process.env.JWT_SECRET === 'string' ? process.env.JWT_SECRET.trim() : '';
    const hasJwtSecret = Boolean(
      rawJwt && !rawJwt.includes('your_jwt_secret') && !rawJwt.includes('placeholder')
    );

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      hasApiKey: hasGemini || hasAnthropic,
      demoAllowed: isDemoOrFallbackAllowed(),
      providers: {
        gemini: hasGemini ? 'active' : 'inactive',
        anthropic: hasAnthropic ? 'active' : 'inactive',
      },
      database: {
        supabase: dbConnected ? 'connected' : 'unconfigured',
        keyMode: dbConnected ? getKeyType(getSecretKey()) : 'none',
      },
      security: {
        jwtSecret: hasJwtSecret ? 'configured' : 'missing',
      },
      geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    });
  });

  // Direct, deterministic route mounting (no broad /api fallback mask)
  app.use('/api/auth', authRoutes);
  app.use('/api', studentAuthRoutes);
  app.use('/api', submissionsRoutes);
  app.use('/api', examsRoutes);
  app.use('/api', authMiddleware, parseRoutes);

  // Serve client static files only in non-Vercel local production mode
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') {
    app.use(express.static(path.join(__dirname, '../client/dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
    });
  }

  // Unified Express Error Handling Middleware
  app.use((err, req, res, next) => {
    console.error(`[API Error ${req.requestId || 'no-id'}]:`, err.message || err);
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Internal Server Error',
      requestId: req.requestId,
    });
  });

  return app;
}

module.exports = { createApp };
