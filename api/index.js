const express = require('express');
const cors = require('cors');
require('dotenv').config();

const parseRoutes = require('../server/routes/parse');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Public: password verification
app.post('/api/verify-password', (req, res) => {
  const { password } = req.body || {};
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword || (password && password.trim() === appPassword.trim())) {
    return res.json({ success: true, message: 'Authenticated successfully.' });
  }
  return res.status(401).json({ success: false, error: 'Incorrect access password.' });
});

// Public: health check
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
    geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  });
});

// Protected: mount parse routes at /api with auth
app.use('/api', authMiddleware, parseRoutes);

module.exports = app;
