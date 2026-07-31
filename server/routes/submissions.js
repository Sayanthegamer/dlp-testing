const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

function getSubmissionsFilePath() {
  const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV || process.env.NODE_ENV === 'production';
  if (isVercel) {
    return path.join('/tmp', 'submissions.json');
  }
  return path.join(__dirname, '..', 'data', 'submissions.json');
}

// Ensure data directory and file exist (with Vercel /tmp fallback)
function ensureDataFile() {
  const filePath = getSubmissionsFilePath();
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
    console.error('[Submissions Dir/File Creation Warning]:', err.message);
    const tmpPath = path.join('/tmp', 'submissions.json');
    try {
      if (!fs.existsSync(tmpPath)) {
        fs.writeFileSync(tmpPath, JSON.stringify([]), 'utf8');
      }
    } catch (tmpErr) {}
    return tmpPath;
  }
}

function readSubmissions() {
  const filePath = ensureDataFile();
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error('[Submissions Read Primary Warning]:', err.message);
    try {
      const rawTmp = fs.readFileSync('/tmp/submissions.json', 'utf8');
      return JSON.parse(rawTmp) || [];
    } catch (tmpErr) {
      return [];
    }
  }
}

function writeSubmissions(data) {
  const filePath = ensureDataFile();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Submissions Write Primary Warning]:', err.message);
    try {
      fs.writeFileSync('/tmp/submissions.json', JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (tmpErr) {
      console.error('[Submissions Write Tmp Fallback Error]:', tmpErr.message);
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
 * PUBLIC Student Endpoint: POST /api/submissions
 * Strictly append-only. Ignores any client-supplied ID.
 * Generates server-side timestamp ID.
 */
router.post('/submissions', (req, res) => {
  const body = req.body || {};
  
  const rawStudentName = typeof body.studentName === 'string' ? body.studentName.trim() : 'Anonymous Candidate';
  const rawTestTitle = typeof body.testTitle === 'string' ? body.testTitle.trim() : 'Mathematics Examination';
  
  // Enforce string length caps (Anti-DoS / Storage protection)
  const studentName = rawStudentName.substring(0, 100);
  const testTitle = rawTestTitle.substring(0, 200);

  if (!Array.isArray(body.questions)) {
    return res.status(400).json({ error: 'Invalid submission payload: questions array required' });
  }

  const serverGeneratedId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const submittedAt = new Date().toISOString();

  const autoGraded = body.autoGraded || { score: 0, total: 0, percentage: 0 };
  const pendingCount = typeof body.pendingCount === 'number' ? body.pendingCount : 0;
  const questions = body.questions || [];
  const studentAnswers = body.studentAnswers || {};

  const submissionObj = {
    id: serverGeneratedId,
    testTitle,
    studentName,
    submittedAt,
    autoGraded,
    pendingCount,
    status: pendingCount > 0 ? 'pending_review' : 'reviewed',
    questions,
    studentAnswers,
    manualGrades: {},
    finalScore: {
      score: autoGraded.score,
      total: questions.length,
      percentage: questions.length > 0 ? Math.round((autoGraded.score / questions.length) * 100) : 0
    }
  };

  const list = readSubmissions();
  list.unshift(submissionObj); // Add to start of array
  const written = writeSubmissions(list);

  return res.json({
    success: written,
    submissionId: serverGeneratedId,
    status: submissionObj.status
  });
});

/**
 * PROTECTED Teacher Endpoint: GET /api/submissions
 * Returns all student submissions (newest first).
 */
router.get('/submissions', (req, res) => {
  if (!isTeacherAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized: Teacher password required' });
  }

  const list = readSubmissions();
  return res.json({
    success: true,
    submissions: list
  });
});

/**
 * PROTECTED Teacher Endpoint: POST /api/submissions/:id/grade
 * Updates manual grades for a specific submission and recalculates final score.
 */
router.post('/submissions/:id/grade', (req, res) => {
  if (!isTeacherAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized: Teacher password required' });
  }

  const targetId = req.params.id;
  const { manualGrades } = req.body || {};

  if (!manualGrades || typeof manualGrades !== 'object') {
    return res.status(400).json({ error: 'manualGrades object required' });
  }

  const list = readSubmissions();
  const subIndex = list.findIndex(s => s.id === targetId);

  if (subIndex === -1) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  const target = list[subIndex];
  
  // Update manual grades
  target.manualGrades = {
    ...target.manualGrades,
    ...manualGrades
  };

  // Recalculate final score
  let totalScore = target.autoGraded ? target.autoGraded.score : 0;
  let manualCorrectCount = 0;

  Object.values(target.manualGrades).forEach(g => {
    if (g && g.status === 'correct') {
      totalScore += (typeof g.score === 'number' ? g.score : 1);
      manualCorrectCount++;
    }
  });

  const totalQuestions = target.questions ? target.questions.length : 0;
  const percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

  target.finalScore = {
    score: totalScore,
    total: totalQuestions,
    percentage
  };

  target.status = 'reviewed';
  target.reviewedAt = new Date().toISOString();

  list[subIndex] = target;
  writeSubmissions(list);

  return res.json({
    success: true,
    submission: target
  });
});

module.exports = router;
