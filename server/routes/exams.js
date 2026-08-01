const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { supabase, isConfigured } = require('../services/supabaseClient');

// In-memory active rolling sessions fallback if Supabase is unconfigured
const activeRollingSessions = new Map();

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
    const tmpPath = path.join('/tmp', 'exams.json');
    try {
      if (!fs.existsSync(tmpPath)) {
        fs.writeFileSync(tmpPath, JSON.stringify([]), 'utf8');
      }
    } catch (tmpErr) {}
    return tmpPath;
  }
}

function readExamsLocal() {
  const filePath = ensureExamsDataFile();
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) || [];
  } catch (err) {
    try {
      const rawTmp = fs.readFileSync('/tmp/exams.json', 'utf8');
      return JSON.parse(rawTmp) || [];
    } catch (tmpErr) {
      return [];
    }
  }
}

function writeExamsLocal(data) {
  const filePath = ensureExamsDataFile();
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    try {
      fs.writeFileSync('/tmp/exams.json', JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (tmpErr) {
      return false;
    }
  }
}

const { verifyTeacherAuth } = require('../services/authService');

/**
 * Generate 6-digit numeric rolling code
 */
function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * PROTECTED Teacher Endpoint: GET /api/exams
 */
router.get('/exams', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  if (isConfigured()) {
    try {
      const { data: examsData, error } = await supabase
        .from('exams')
        .select('id, title, question_count, status, created_at')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(examsData)) {
        const formatted = examsData.map(e => ({
          id: e.id,
          testTitle: e.title,
          questionCount: e.question_count || 0,
          createdAt: e.created_at,
          status: e.status || 'active',
          submissionCount: 0
        }));
        return res.json({ success: true, exams: formatted });
      }
    } catch (dbErr) {
      console.warn('[Supabase DB Read Warning]:', dbErr.message);
    }
  }

  const exams = readExamsLocal();
  const formatted = exams.map(e => ({
    id: e.id,
    testTitle: e.testTitle,
    questionCount: Array.isArray(e.questions) ? e.questions.length : 0,
    createdAt: e.createdAt,
    status: e.status || 'active',
    submissionCount: 0
  }));

  return res.json({ success: true, exams: formatted });
});

/**
 * PROTECTED Teacher Endpoint: POST /api/exams/publish
 */
router.post('/exams/publish', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required to publish exams' });
  }


  const { testTitle, questions } = req.body || {};
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Invalid exam snapshot: questions array required' });
  }

  const serverGeneratedId = `exam_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const createdAt = new Date().toISOString();
  const cleanTitle = typeof testTitle === 'string' && testTitle.trim() ? testTitle.trim() : 'Mathematics Practice Test';

  const examSnapshot = {
    id: serverGeneratedId,
    testTitle: cleanTitle,
    questions,
    createdAt,
    status: 'active'
  };

  if (isConfigured()) {
    try {
      await supabase.from('exams').insert({
        id: serverGeneratedId,
        title: cleanTitle,
        question_count: questions.length,
        status: 'active',
        snapshot_data: examSnapshot
      });
    } catch (dbErr) {
      console.warn('[Supabase Exam Insert Warning]:', dbErr.message);
    }
  }

  const list = readExamsLocal();
  list.unshift(examSnapshot);
  writeExamsLocal(list);

  return res.json({
    success: true,
    examId: serverGeneratedId,
    testTitle: cleanTitle,
    createdAt,
    status: 'active'
  });
});

/**
 * PROTECTED Teacher Endpoint: POST /api/exams/session/start
 * Generates an active 6-digit rolling code for live student test access.
 */
router.post('/exams/session/start', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }


  const { examId } = req.body || {};
  if (!examId) {
    return res.status(400).json({ error: 'examId is required to start a test session' });
  }

  const rollingCode = generate6DigitCode();
  const createdAt = new Date().toISOString();

  if (isConfigured()) {
    try {
      // Deactivate old active sessions for this exam
      await supabase
        .from('exam_sessions')
        .update({ is_active: false })
        .eq('exam_id', examId);

      // Insert new session
      await supabase.from('exam_sessions').insert({
        exam_id: examId,
        rolling_code: rollingCode,
        is_active: true
      });
    } catch (dbErr) {
      console.warn('[Supabase Session Insert Warning]:', dbErr.message);
    }
  }

  activeRollingSessions.set(rollingCode, {
    examId,
    rollingCode,
    createdAt
  });

  return res.json({
    success: true,
    examId,
    rollingCode,
    createdAt,
    message: 'Active rolling session started successfully.'
  });
});

/**
 * PUBLIC Student Endpoint: POST /api/exams/student-access
 * Validates Student Name + 6-Digit Rolling Code to unlock test payload.
 */
router.post('/exams/student-access', async (req, res) => {
  const { studentName, rollingCode, examId } = req.body || {};

  if (!studentName || !studentName.trim()) {
    return res.status(400).json({ error: 'Student Name is required.' });
  }

  const cleanCode = (rollingCode || '').trim();
  let matchedSession = null;
  let targetExamId = examId || null;

  if (cleanCode) {
    if (isConfigured()) {
      try {
        let query = supabase
          .from('exam_sessions')
          .select('id, exam_id, rolling_code, is_active')
          .eq('rolling_code', cleanCode)
          .eq('is_active', true);

        if (examId) {
          query = query.eq('exam_id', examId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          matchedSession = data[0];
          targetExamId = matchedSession.exam_id;
        }
      } catch (dbErr) {
        console.warn('[Supabase Session Check Warning]:', dbErr.message);
      }
    }

    if (!matchedSession && activeRollingSessions.has(cleanCode)) {
      matchedSession = activeRollingSessions.get(cleanCode);
      targetExamId = matchedSession.examId || matchedSession.exam_id;
    }

    if (!matchedSession) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired Rolling Passcode. Please ask your instructor for the current live passcode.'
      });
    }
  }

  if (!targetExamId) {
    return res.status(400).json({ error: 'Exam link or Rolling Code is required.' });
  }

  let examPayload = null;

  if (isConfigured()) {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('snapshot_data, status')
        .eq('id', targetExamId)
        .single();

      if (!error && data?.snapshot_data) {
        if (data.status === 'closed') {
          return res.status(403).json({
            success: false,
            error: 'This exam has been closed by the instructor.'
          });
        }
        examPayload = data.snapshot_data;
      }
    } catch (e) {}
  }

  if (!examPayload) {
    const list = readExamsLocal();
    const localExam = list.find(e => e.id === targetExamId);
    if (localExam) {
      if (localExam.status === 'closed') {
        return res.status(403).json({
          success: false,
          error: 'This exam has been closed by the instructor.'
        });
      }
      examPayload = localExam;
    }
  }

  if (!examPayload) {
    return res.status(404).json({ error: 'Exam paper snapshot not found or link has expired.' });
  }

  return res.json({
    success: true,
    exam: examPayload,
    studentName: studentName.trim(),
    rollingCodeUsed: cleanCode || 'DIRECT_LINK'
  });
});


/**
 * PUBLIC Student Endpoint: GET /api/exams/:id
 */
router.get('/exams/:id', async (req, res) => {
  const targetId = req.params.id;

  if (isConfigured()) {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('snapshot_data, status')
        .eq('id', targetId)
        .single();

      if (!error && data?.snapshot_data) {
        if (data.status === 'closed') {
          return res.status(403).json({
            success: false,
            isClosed: true,
            error: 'This exam has been closed by the instructor.'
          });
        }
        return res.json({ success: true, exam: data.snapshot_data });
      }
    } catch (e) {}
  }

  const list = readExamsLocal();
  const exam = list.find(e => e.id === targetId);

  if (!exam) {
    return res.status(404).json({ error: 'Exam paper snapshot not found or link has expired.' });
  }

  if (exam.status === 'closed') {
    return res.status(403).json({
      success: false,
      isClosed: true,
      error: 'This exam has been closed by the instructor.'
    });
  }

  return res.json({ success: true, exam });
});

module.exports = router;
