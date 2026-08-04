const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const parseRoutes = require('./routes/parse');
const submissionsRoutes = require('./routes/submissions');
const examsRoutes = require('./routes/exams');
const authRoutes = require('./routes/auth');
const { verifyTeacherAuth } = require('./services/authService');

const authMiddleware = async (req, res, next) => {
  const isAuthorized = await verifyTeacherAuth(req);
  if (isAuthorized) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Unauthorized teacher access.' });
};

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.CLIENT_ORIGIN, // e.g. https://your-app.vercel.app
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
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
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  });
});

// Submissions, Exams & Auth API routes
app.use('/api/auth', authRoutes);
app.use('/api', submissionsRoutes);
app.use('/api', examsRoutes);


// Protect remaining parsing API routes
app.use('/api', authMiddleware, parseRoutes);

// Serve client static files only in non-Vercel local production mode
if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
  });
}

// Express Error Handling Middleware Standard (4 parameters required)
app.use((err, req, res, next) => {
  console.error('[Server Global Error]:', err.message || err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Only call app.listen in standalone mode (not when imported as Vercel serverless function)

if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV) {
  app.listen(PORT, () => {
    const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5 && !process.env.GEMINI_API_KEY.includes('your_'));
    const hasAnthropic = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 5 && !process.env.ANTHROPIC_API_KEY.includes('your_'));

    console.log(`=================================`);
    console.log(`Math Pipeline Server running on http://localhost:${PORT}`);
    console.log(`Gemini API (${process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'}): ${hasGemini ? 'ACTIVE' : 'OFF'}`);
    console.log(`Anthropic API: ${hasAnthropic ? 'ACTIVE' : 'OFF'}`);
    console.log(`Mode: ${hasGemini || hasAnthropic ? 'Live API (with failover)' : 'Smart Demo Fallback Mode'}`);
    console.log(`=================================`);
  });
}

module.exports = app;

