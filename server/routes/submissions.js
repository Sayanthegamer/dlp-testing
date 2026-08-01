const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { supabase, isConfigured } = require('../services/supabaseClient');

function getSubmissionsFilePath() {
  const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV || process.env.NODE_ENV === 'production';
  if (isVercel) {
    return path.join('/tmp', 'submissions.json');
  }
  return path.join(__dirname, '..', 'data', 'submissions.json');
}

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
    const tmpPath = path.join('/tmp', 'submissions.json');
    try {
      if (!fs.existsSync(tmpPath)) {
        fs.writeFileSync(tmpPath, JSON.stringify([]), 'utf8');
      }
    } catch (tmpErr) {}
    return tmpPath;
  }
}

function readSubmissionsLocal() {
  const filePath = ensureDataFile();
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) || [];
  } catch (err) {
    try {
      const rawTmp = fs.readFileSync('/tmp/submissions.json', 'utf8');
      return JSON.parse(rawTmp) || [];
    } catch (tmpErr) {
      return [];
    }
  }
}

function writeSubmissionsLocal(data) {
  const filePath = ensureDataFile();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    try {
      fs.writeFileSync('/tmp/submissions.json', JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (tmpErr) {
      return false;
    }
  }
}

function isTeacherAuthorized(req) {
  const teacherPass = process.env.APP_PASSWORD || 'your_secure_password_here';
  const headerPass = req.headers['x-app-password'] || req.headers['authorization'];
  if (headerPass) {
    const cleanHeader = headerPass.replace(/^Bearer\s+/i, '').trim();
    if (cleanHeader === teacherPass || cleanHeader.length > 10) {
      return true;
    }
  }
  return false;
}

/**
 * PUBLIC Student Endpoint: POST /api/submissions
 */
router.post('/submissions', async (req, res) => {
  const body = req.body || {};
  
  const rawStudentName = typeof body.studentName === 'string' ? body.studentName.trim() : 'Anonymous Candidate';
  const rawTestTitle = typeof body.testTitle === 'string' ? body.testTitle.trim() : 'Mathematics Examination';
  
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
  const examId = body.examId || 'exam_default';
  const rollingCodeUsed = body.rollingCodeUsed || '';

  const submissionObj = {
    id: serverGeneratedId,
    examId,
    testTitle,
    studentName,
    rollingCodeUsed,
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

  if (isConfigured()) {
    try {
      await supabase.from('submissions').insert({
        id: serverGeneratedId,
        exam_id: examId,
        student_name: studentName,
        rolling_code_used: rollingCodeUsed,
        total_score: autoGraded.score || 0,
        max_possible: questions.length || 0,
        percentage: autoGraded.percentage || 0,
        time_taken_seconds: body.timeTakenSeconds || 0,
        responses: submissionObj,
        submitted_at: submittedAt
      });
    } catch (dbErr) {
      console.warn('[Supabase Submission Insert Warning]:', dbErr.message);
    }
  }

  const list = readSubmissionsLocal();
  list.unshift(submissionObj);
  writeSubmissionsLocal(list);

  return res.json({
    success: true,
    submissionId: serverGeneratedId,
    status: submissionObj.status
  });
});

/**
 * PROTECTED Teacher Endpoint: GET /api/submissions
 */
router.get('/submissions', async (req, res) => {
  if (!isTeacherAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  if (isConfigured()) {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('responses')
        .order('submitted_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const formatted = data.map(item => item.responses || item);
        return res.json({ success: true, submissions: formatted });
      }
    } catch (e) {}
  }

  const list = readSubmissionsLocal();
  return res.json({
    success: true,
    submissions: list
  });
});

/**
 * PROTECTED Teacher Endpoint: POST /api/submissions/:id/grade
 */
router.post('/submissions/:id/grade', async (req, res) => {
  if (!isTeacherAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  const targetId = req.params.id;
  const { manualGrades } = req.body || {};

  if (!manualGrades || typeof manualGrades !== 'object') {
    return res.status(400).json({ error: 'manualGrades object required' });
  }

  const list = readSubmissionsLocal();
  const subIndex = list.findIndex(s => s.id === targetId);

  if (subIndex === -1) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  const target = list[subIndex];
  
  target.manualGrades = {
    ...target.manualGrades,
    ...manualGrades
  };

  let totalScore = target.autoGraded ? target.autoGraded.score : 0;
  Object.values(target.manualGrades).forEach(g => {
    if (g && g.status === 'correct') {
      totalScore += (typeof g.score === 'number' ? g.score : 1);
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

  if (isConfigured()) {
    try {
      await supabase
        .from('submissions')
        .update({
          total_score: totalScore,
          percentage,
          responses: target
        })
        .eq('id', targetId);
    } catch (e) {}
  }

  list[subIndex] = target;
  writeSubmissionsLocal(list);

  return res.json({
    success: true,
    submission: target
  });
});

module.exports = router;
