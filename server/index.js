const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const parseRoutes = require('./routes/parse');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Auth Gate Middleware: verify request header against APP_PASSWORD
const authMiddleware = (req, res, next) => {
  const appPassword = process.env.APP_PASSWORD;
  
  // If APP_PASSWORD is not set in environment, allow access (or lock if desired)
  if (!appPassword) {
    return next();
  }

  const authHeader = req.headers['x-app-password'] || req.headers.authorization;
  if (authHeader === appPassword || authHeader === `Bearer ${appPassword}`) {
    return next();
  }

  return res.status(401).json({ success: false, error: 'Unauthorized: Invalid access password.' });
};

// Public endpoints
app.post('/api/verify-password', (req, res) => {
  const { password } = req.body;
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword || password === appPassword) {
    return res.json({ success: true, message: 'Authenticated successfully.' });
  }

  return res.status(401).json({ success: false, error: 'Incorrect access password.' });
});

app.get('/api/health', (req, res) => {
  const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5 && !process.env.GEMINI_API_KEY.includes('your_'));
  const hasAnthropic = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 5 && !process.env.ANTHROPIC_API_KEY.includes('your_'));

  res.json({
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

// Protect remaining parsing API routes
app.use('/api', authMiddleware, parseRoutes);

// Serve client static files only in non-Vercel local production mode
if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
  });
}

// Only call app.listen in standalone mode (not when imported as Vercel serverless function)
if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV) {
  app.listen(PORT, () => {
    const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5 && !process.env.GEMINI_API_KEY.includes('your_'));
    const hasAnthropic = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 5 && !process.env.ANTHROPIC_API_KEY.includes('your_'));

    console.log(`=================================`);
    console.log(`Math Pipeline Server running on http://localhost:${PORT}`);
    console.log(`Gemini API (${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}): ${hasGemini ? 'ACTIVE' : 'OFF'}`);
    console.log(`Anthropic API: ${hasAnthropic ? 'ACTIVE' : 'OFF'}`);
    console.log(`Mode: ${hasGemini || hasAnthropic ? 'Live API (with failover)' : 'Smart Demo Fallback Mode'}`);
    console.log(`=================================`);
  });
}

module.exports = app;

