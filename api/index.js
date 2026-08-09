const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { verifyTeacherAuth } = require('../server/services/authService');

const app = express();

// CORS — same policy as server/index.js
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.CLIENT_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin === allowed || origin.endsWith('.vercel.app'))) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Origin not allowed'), false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Auth Gate Middleware: same verifyTeacherAuth used by server/index.js
const authMiddleware = async (req, res, next) => {
  const isAuthorized = await verifyTeacherAuth(req);
  if (isAuthorized) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Unauthorized teacher access.' });
};

// 1. Register Lightweight Zero-Dependency Routes FIRST (guaranteed to never 500 on cold start)
app.get('/api/health', (req, res) => {
  const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5 && !process.env.GEMINI_API_KEY.includes('your_'));
  const hasAnthropic = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 5 && !process.env.ANTHROPIC_API_KEY.includes('your_'));

  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasApiKey: hasGemini || hasAnthropic,
    providers: {
      gemini: hasGemini ? 'active' : 'inactive',
      anthropic: hasAnthropic ? 'active' : 'inactive'
    },
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  });
});

// 2. Safe Mount Helper using literal require callbacks so Vercel's NFT AST tracer bundles the files
function safeMount(pathPrefix, loadFn, ...middleware) {
  try {
    const router = loadFn();
    if (middleware.length > 0) {
      app.use(pathPrefix, ...middleware, router);
    } else {
      app.use(pathPrefix, router);
    }
  } catch (err) {
    console.error(`[Vercel Safe Mount Error]:`, err.message);
    app.use(pathPrefix, (req, res) => {
      res.status(503).json({
        success: false,
        error: `Route module failed to load on serverless function: ${err.message}`
      });
    });
  }
}

// 3. Defensively Mount Application Routes with Literal Require Strings for Vercel Tracing
safeMount('/api/auth', () => require('../server/routes/auth'));
safeMount('/api', () => require('../server/routes/studentAuth'));
safeMount('/api', () => require('../server/routes/submissions'));
safeMount('/api', () => require('../server/routes/exams'));
safeMount('/api', () => require('../server/routes/parse'), authMiddleware);

// 4. Express Error Handling Middleware Standard (4 parameters required)
app.use((err, req, res, next) => {
  console.error('[Express API Global Error]:', err.message || err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

module.exports = app;
