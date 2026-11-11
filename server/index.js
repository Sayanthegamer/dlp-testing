require('dotenv').config();
const { createApp } = require('./app');
const { isConfigured, getKeyType, getSecretKey } = require('./services/supabaseClient');
const { isDemoOrFallbackAllowed } = require('./services/authService');

const app = createApp();
const PORT = process.env.PORT || 5000;

if (
  process.env.VERCEL !== '1' &&
  !process.env.VERCEL_ENV &&
  process.env.NODE_ENV !== 'test' &&
  process.env.VITEST !== 'true'
) {
  if (!isConfigured() && !isDemoOrFallbackAllowed()) {
    console.error(
      '[FATAL]: Refusing to start in production without durable Supabase storage configured.'
    );
    process.exit(1);
  }

  app.listen(PORT, () => {
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

    console.log(`=================================`);
    console.log(`Math Pipeline Server running on http://localhost:${PORT}`);
    console.log(
      `Supabase DB: ${
        isConfigured()
          ? `ACTIVE (${getKeyType(getSecretKey())} key mode)`
          : 'OFF (local dev file store)'
      }`
    );
    console.log(
      `Gemini API (${process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'}): ${
        hasGemini ? 'ACTIVE' : 'OFF'
      }`
    );
    console.log(`Anthropic API: ${hasAnthropic ? 'ACTIVE' : 'OFF'}`);
    console.log(`=================================`);
  });
}

module.exports = app;
