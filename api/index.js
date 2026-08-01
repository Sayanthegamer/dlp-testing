const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// Auth Gate Middleware: verify request header against APP_PASSWORD
const authMiddleware = (req, res, next) => {
  const appPassword = process.env.APP_PASSWORD;
  
  if (!appPassword) {
    return next();
  }

  const authHeader = req.headers['x-app-password'] || req.headers.authorization;
  if (authHeader === appPassword || authHeader === `Bearer ${appPassword}`) {
    return next();
  }

  return res.status(401).json({ success: false, error: 'Unauthorized: Invalid access password.' });
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

app.post('/api/verify-password', (req, res) => {
  const { password } = req.body || {};
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword || (password && password.trim() === appPassword.trim())) {
    return res.json({ success: true, message: 'Authenticated successfully.' });
  }
  return res.status(401).json({ success: false, error: 'Incorrect access password.' });
});

app.post('/api/verify-student-password', (req, res) => {
  const { password } = req.body || {};
  const studentPassword = process.env.STUDENT_PASSWORD;

  if (!studentPassword || (password && password.trim() === studentPassword.trim())) {
    return res.json({ success: true, message: 'Student authenticated successfully.' });
  }
  return res.status(401).json({ success: false, error: 'Incorrect student access password.' });
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
safeMount('/api', () => require('../server/routes/submissions'));
safeMount('/api', () => require('../server/routes/exams'));
safeMount('/api', () => require('../server/routes/parse'), authMiddleware);

module.exports = app;
