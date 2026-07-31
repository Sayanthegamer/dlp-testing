const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

function getExamsFilePath() {
  const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV || process.env.NODE_ENV === 'production';
  if (isVercel) {
    return path.join('/tmp', 'exams.json');
  }
  return path.join(__dirname, '..', 'data', 'exams.json');
}

function ensureExamsDataFile() {
  const filePath = getExamsFilePath();
  const dirPath = path.dirname(filePath);
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([]), 'utf8');
    }
    return filePath;
  } catch (err) {
    console.error('[Exams Dir/File Creation Warning]:', err.message);
    const tmpPath = path.join('/tmp', 'exams.json');
    try {
      if (!fs.existsSync(tmpPath)) {
        fs.writeFileSync(tmpPath, JSON.stringify([]), 'utf8');
      }
    } catch (tmpErr) {}
    return tmpPath;
  }
}

function readExams() {
  const filePath = ensureExamsDataFile();
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error('[Exams Read Primary Warning]:', err.message);
    try {
      const rawTmp = fs.readFileSync('/tmp/exams.json', 'utf8');
      return JSON.parse(rawTmp) || [];
    } catch (tmpErr) {
      return [];
    }
  }
}

function writeExams(data) {
  const filePath = ensureExamsDataFile();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Exams Write Primary Warning]:', err.message);
    try {
      fs.writeFileSync('/tmp/exams.json', JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (tmpErr) {
      console.error('[Exams Write Tmp Fallback Error]:', tmpErr.message);
      return false;
    }
  }
}

// Teacher Authentication Middleware helper
function isTeacherAuthorized(req) {
  const teacherPass = process.env.APP_PASSWORD || 'your_secure_password_here';
  const headerPass = req.headers['x-app-password'] || req.headers['authorization'];
  if (headerPass && headerPass.replace(/^Bearer\s+/i, '') === teacherPass) {
    return true;
  }
  return false;
}

/**
 * Helper to count submissions per exam snapshot
 */
function readSubmissionsForMetrics() {
  const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV || process.env.NODE_ENV === 'production';
  const filePath = isVercel ? path.join('/tmp', 'submissions.json') : path.join(__dirname, '..', 'data', 'submissions.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) || [];
  } catch (e) {
    try {
      const rawTmp = fs.readFileSync('/tmp/submissions.json', 'utf8');
      return JSON.parse(rawTmp) || [];
    } catch (tmpErr) {
      return [];
    }
  }
}

/**
 * PROTECTED Teacher Endpoint: GET /api/exams
 * Returns list of all published exam snapshots with submission metrics.
 */
router.get('/exams', (req, res) => {
  if (!isTeacherAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized: Teacher password required' });
  }

  const exams = readExams();
  const submissions = readSubmissionsForMetrics();

  const formatted = exams.map(e => {
    const subCount = submissions.filter(s => s.examId === e.id || s.testTitle === e.testTitle).length;
    return {
      id: e.id,
      testTitle: e.testTitle,
      questionCount: Array.isArray(e.questions) ? e.questions.length : 0,
      createdAt: e.createdAt,
      status: e.status || 'active',
      submissionCount: subCount
    };
  });

  return res.json({
    success: true,
    exams: formatted
  });
});

/**
 * PROTECTED Teacher Endpoint: PATCH /api/exams/:id/status
 * Toggles or sets exam active/closed status.
 */
router.patch('/exams/:id/status', (req, res) => {
  if (!isTeacherAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized: Teacher password required' });
  }

  const targetId = req.params.id;
  const { status } = req.body || {};

  const exams = readExams();
  const examIndex = exams.findIndex(e => e.id === targetId);

  if (examIndex === -1) {
    return res.status(404).json({ error: 'Exam snapshot not found' });
  }

  const target = exams[examIndex];
  const newStatus = status ? status : (target.status === 'closed' ? 'active' : 'closed');
  
  target.status = newStatus;
  target.updatedAt = new Date().toISOString();
  exams[examIndex] = target;

  writeExams(exams);

  return res.json({
    success: true,
    examId: target.id,
    status: target.status
  });
});

/**
 * PROTECTED Teacher Endpoint: POST /api/exams/publish
 * Freezes the current test title & questions into a permanent exam snapshot.
 */
router.post('/exams/publish', (req, res) => {
  if (!isTeacherAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized: Teacher password required to publish exams' });
  }

  const { testTitle, questions } = req.body || {};
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Invalid exam snapshot: questions array required' });
  }

  const serverGeneratedId = `exam_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const createdAt = new Date().toISOString();

  const examSnapshot = {
    id: serverGeneratedId,
    testTitle: typeof testTitle === 'string' && testTitle.trim() ? testTitle.trim() : 'Mathematics Practice Test',
    questions,
    createdAt,
    status: 'active'
  };

  const list = readExams();
  list.unshift(examSnapshot);
  const written = writeExams(list);

  return res.json({
    success: written,
    examId: serverGeneratedId,
    testTitle: examSnapshot.testTitle,
    createdAt,
    status: 'active'
  });
});

/**
 * PUBLIC Student Endpoint: GET /api/exams/:id
 * Returns the frozen exam snapshot payload for student test-taking.
 */
router.get('/exams/:id', (req, res) => {
  const targetId = req.params.id;
  const list = readExams();
  const exam = list.find(e => e.id === targetId);

  if (!exam) {
    return res.status(404).json({ error: 'Exam paper snapshot not found or link has expired.' });
  }

  // Check if exam is closed by teacher
  if (exam.status === 'closed') {
    return res.status(403).json({
      success: false,
      isClosed: true,
      error: 'This exam has been closed by the instructor and is no longer accepting submissions.'
    });
  }

  return res.json({
    success: true,
    exam: {
      id: exam.id,
      testTitle: exam.testTitle,
      questions: exam.questions,
      createdAt: exam.createdAt,
      status: exam.status || 'active'
    }
  });
});

module.exports = router;
