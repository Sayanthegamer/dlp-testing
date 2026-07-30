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

// Silence Chrome DevTools .well-known probe warning
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});

// API Routes
app.use('/api', parseRoutes);

// Health check endpoint
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

// Serve client static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
  });
}

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
