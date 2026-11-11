require('dotenv').config();

// Keep literal require references so Vercel's Node File Tracer (NFT) bundles all route modules
require('../server/routes/auth');
require('../server/routes/studentAuth');
require('../server/routes/submissions');
require('../server/routes/exams');
require('../server/routes/parse');

const { createApp } = require('../server/app');

const app = createApp();

module.exports = app;
