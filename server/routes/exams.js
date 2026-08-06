const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { supabase, isConfigured, createUserClient } = require('../services/supabaseClient');

// In-memory active rolling sessions fallback if Supabase is unconfigured
const activeRollingSessions = new Map();
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Evicts expired entries from the in-memory rolling sessions map.
 */
function evictExpiredSessions() {
  const now = Date.now();
  for (const [code, session] of activeRollingSessions) {
    const createdMs = session.createdAt ? new Date(session.createdAt).getTime() : 0;
    if (now - createdMs > SESSION_TTL_MS) {
      activeRollingSessions.delete(code);
    }
  }
}

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
 * Computes deterministic 6-digit rolling passcode for a 5-minute time bucket (300 seconds).
 */
function get5MinRollingCode(examId, windowOffset = 0) {
  if (!examId) return '849201';
  const timeBucket = Math.floor(Date.now() / (5 * 60 * 1000)) + windowOffset;
  const secret = process.env.APP_PASSWORD || 'rolling-passcode-secret-key';
  const hash = crypto.createHmac('sha256', secret).update(`${examId}_${timeBucket}`).digest('hex');
  const codeNum = (parseInt(hash.substring(0, 8), 16) % 900000) + 100000;
  return codeNum.toString();
}

function get5MinSecondsRemaining() {
  const currentMs = Date.now();
  const windowMs = 5 * 60 * 1000;
  const elapsedMs = currentMs % windowMs;
  return Math.max(1, Math.ceil((windowMs - elapsedMs) / 1000));
}

/**
 * PROTECTED Teacher Endpoint: GET /api/exams
 */
router.get('/exams', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  if (isConfigured()) {
    const userDb = createUserClient(req.accessToken);
    try {
      const { data: examsData, error } = await userDb
        .from('exams')
        .select('id, title, question_count, status, created_at')
        .eq('teacher_id', req.user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Supabase Exams Fetch Error]:', error.message);
        return res.status(500).json({ error: `Database error fetching exams: ${error.message}` });
      }

      const examList = Array.isArray(examsData) ? examsData : [];
      const examIds = examList.map(e => e.id);
      let submissionCounts = {};

      if (examIds.length > 0) {
        try {
          const { data: subData } = await userDb
            .from('submissions')
            .select('exam_id')
            .in('exam_id', examIds);
          if (Array.isArray(subData)) {
            subData.forEach(s => {
              submissionCounts[s.exam_id] = (submissionCounts[s.exam_id] || 0) + 1;
            });
          }
        } catch (subErr) {
          console.warn('[Supabase Submission Count Warning]:', subErr.message);
        }
      }

      const formatted = examList.map(e => ({
        id: e.id,
        testTitle: e.title,
        questionCount: e.question_count || 0,
        createdAt: e.created_at,
        status: e.status || 'active',
        submissionCount: submissionCounts[e.id] || 0
      }));

      return res.json({ success: true, exams: formatted });
    } catch (dbErr) {
      console.error('[Supabase DB Read Exception]:', dbErr.message);
      return res.status(500).json({ error: `Database error fetching exams: ${dbErr.message}` });
    }
  } else {
    // Unconfigured local dev mode fallback
    const exams = readExamsLocal();
    let localSubmissions = [];
    try {
      const subPath = path.join(__dirname, '..', 'data', 'submissions.json');
      if (fs.existsSync(subPath)) {
        localSubmissions = JSON.parse(fs.readFileSync(subPath, 'utf8')) || [];
      }
    } catch (e) {}
    const localSubCounts = {};
    localSubmissions.forEach(s => {
      if (s.examId) localSubCounts[s.examId] = (localSubCounts[s.examId] || 0) + 1;
    });

    const formatted = exams.map(e => ({
      id: e.id,
      testTitle: e.testTitle,
      questionCount: Array.isArray(e.questions) ? e.questions.length : 0,
      createdAt: e.createdAt,
      status: e.status || 'active',
      submissionCount: localSubCounts[e.id] || 0
    }));

    return res.json({ success: true, exams: formatted });
  }
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
    const userDb = createUserClient(req.accessToken);
    try {
      // 1. Ensure teacher record exists in teachers table
      if (req.user?.id) {
        const { error: tErr } = await userDb.from('teachers').upsert({
          id: req.user.id,
          email: req.user.email || 'teacher@local.dev',
          full_name: req.user.user_metadata?.full_name || req.user.email?.split('@')[0] || 'Teacher'
        }, { onConflict: 'id' });
        if (tErr) {
          console.warn('[Supabase Teacher Upsert Warning]:', tErr.message);
        }
      }

      const { error: insertErr } = await userDb.from('exams').insert({
        id: serverGeneratedId,
        title: cleanTitle,
        question_count: questions.length,
        status: 'active',
        teacher_id: req.user?.id,
        snapshot_data: examSnapshot
      }).select();

      if (insertErr) {
        console.error('[Supabase Exam Insert Error]:', insertErr.message);
        return res.status(500).json({ error: `Failed to publish exam to database: ${insertErr.message}` });
      }

      console.log(`[Supabase Exams] Successfully published exam ${serverGeneratedId} to database.`);
      return res.json({
        success: true,
        examId: serverGeneratedId,
        testTitle: cleanTitle,
        createdAt,
        status: 'active'
      });
    } catch (dbErr) {
      console.error('[Supabase Exam Insert Exception]:', dbErr.message);
      return res.status(500).json({ error: `Database error publishing exam: ${dbErr.message}` });
    }
  } else {
    // Unconfigured local dev mode fallback
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
  }
});

/**
 * PROTECTED Teacher Endpoint: POST /api/exams/session/start
 * Generates/fetches the current 5-minute rolling code for live student test access.
 */
router.post('/exams/session/start', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  const { examId } = req.body || {};
  if (!examId) {
    return res.status(400).json({ error: 'examId is required to start a test session' });
  }

  const rollingCode = get5MinRollingCode(examId, 0);
  const secondsRemaining = get5MinSecondsRemaining();
  const createdAt = new Date().toISOString();

  if (isConfigured()) {
    const userDb = createUserClient(req.accessToken);
    if (!userDb) {
      return res.status(500).json({ error: 'Database client initialization failed.' });
    }

    try {
      const { data: examData, error: examErr } = await userDb.from('exams').select('status').eq('id', examId).single();
      if (examErr) {
        console.error('[Supabase Exam Status Lookup Error]:', examErr.message);
        return res.status(500).json({ error: `Database error verifying exam status: ${examErr.message}` });
      }
      if (examData && examData.status === 'closed') {
        return res.status(403).json({ error: 'Cannot start rolling session for a closed exam. Please re-open the exam first.' });
      }

      // Deactivate old active sessions for this exam
      await userDb.from('exam_sessions').update({ is_active: false }).eq('exam_id', examId);

      // Insert new session
      const { error: sessionErr } = await userDb.from('exam_sessions').insert({
        exam_id: examId,
        rolling_code: rollingCode,
        is_active: true
      });

      if (sessionErr) {
        console.error('[Supabase Session Insert Error]:', sessionErr.message);
        return res.status(500).json({ error: `Failed to record active test session in database: ${sessionErr.message}` });
      }

      evictExpiredSessions();
      activeRollingSessions.set(rollingCode, { examId, rollingCode, createdAt });

      return res.json({
        success: true,
        examId,
        rollingCode,
        secondsRemaining,
        intervalMinutes: 5,
        createdAt,
        message: 'Active 5-minute rolling session code fetched successfully.'
      });
    } catch (dbErr) {
      console.error('[Supabase Session Start Exception]:', dbErr.message);
      return res.status(500).json({ error: `Database error starting session: ${dbErr.message}` });
    }
  } else {
    // Unconfigured local dev mode fallback
    const list = readExamsLocal();
    const localExam = list.find(e => e.id === examId);
    if (localExam && localExam.status === 'closed') {
      return res.status(403).json({ error: 'Cannot start rolling session for a closed exam. Please re-open the exam first.' });
    }

    evictExpiredSessions();
    activeRollingSessions.set(rollingCode, { examId, rollingCode, createdAt });

    return res.json({
      success: true,
      examId,
      rollingCode,
      secondsRemaining,
      intervalMinutes: 5,
      createdAt,
      message: 'Active 5-minute rolling session code fetched successfully.'
    });
  }
});

/**
 * PUBLIC Student Endpoint: POST /api/exams/student-access
 * Validates Student Name + 6-Digit Rolling Code (Current 5-min window or 5-min grace window).
 * Rolling passcode is STRICTLY REQUIRED for all students (including direct links).
 */
router.post('/exams/student-access', async (req, res) => {
  const { studentName, rollingCode, examId } = req.body || {};

  if (!studentName || !studentName.trim()) {
    return res.status(400).json({ error: 'Student Name is required.' });
  }

  const cleanCode = (rollingCode || '').trim();
  if (!cleanCode) {
    return res.status(400).json({ error: 'A valid 6-Digit Rolling Passcode is required to enter this exam.' });
  }

  let matchedSession = null;
  let targetExamId = examId || null;

  // 1. Check 5-minute TOTP auto-rolling codes (current window or 5-min grace window)
  if (examId) {
    const current5MinCode = get5MinRollingCode(examId, 0);
    const grace5MinCode = get5MinRollingCode(examId, -1);

    if (cleanCode === current5MinCode || cleanCode === grace5MinCode) {
      matchedSession = { exam_id: examId, rolling_code: cleanCode };
      targetExamId = examId;
    }
  }

  if (isConfigured()) {
    if (!matchedSession) {
      try {
        let query = supabase
          .from('exam_sessions')
          .select('id, exam_id, rolling_code, is_active')
          .eq('is_active', true);

        if (examId) {
          query = query.eq('exam_id', examId);
        }

        const { data, error } = await query;
        if (error) {
          console.error('[Supabase Session Lookup Error]:', error.message);
          return res.status(500).json({ error: `Database error checking session passcode: ${error.message}` });
        }

        if (Array.isArray(data) && data.length > 0) {
          const matchedItem = data.find(session => {
            const currentCode = get5MinRollingCode(session.exam_id, 0);
            const previousCode = get5MinRollingCode(session.exam_id, -1);
            return cleanCode === currentCode || cleanCode === previousCode || cleanCode === session.rolling_code;
          });

          if (matchedItem) {
            matchedSession = matchedItem;
            targetExamId = matchedSession.exam_id;
          }
        }
      } catch (dbErr) {
        console.error('[Supabase Session Check Exception]:', dbErr.message);
        return res.status(500).json({ error: `Database error checking session passcode: ${dbErr.message}` });
      }
    }

    if (!matchedSession) {
      evictExpiredSessions();
      for (const session of activeRollingSessions.values()) {
        const sessionExamId = session.examId || session.exam_id;
        if (examId && sessionExamId !== examId) continue;

        const currentCode = get5MinRollingCode(sessionExamId, 0);
        const previousCode = get5MinRollingCode(sessionExamId, -1);

        if (cleanCode === currentCode || cleanCode === previousCode || cleanCode === session.rollingCode) {
          matchedSession = session;
          targetExamId = sessionExamId;
          break;
        }
      }
    }

    if (!matchedSession) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired 6-Digit Passcode. Rolling codes automatically refresh every 5 minutes. Please ask your instructor for the current passcode.'
      });
    }

    if (!targetExamId) {
      return res.status(400).json({ error: 'Exam target ID could not be identified.' });
    }

    try {
      const { data, error: examErr } = await supabase
        .from('exams')
        .select('snapshot_data, status')
        .eq('id', targetExamId)
        .single();

      if (examErr || !data || !data.snapshot_data) {
        return res.status(404).json({ error: 'Exam paper snapshot not found or link has expired.' });
      }

      if (data.status === 'closed') {
        return res.status(403).json({
          success: false,
          error: 'This exam has been closed by the instructor.'
        });
      }

      return res.json({
        success: true,
        exam: data.snapshot_data,
        studentName: studentName.trim(),
        rollingCodeUsed: cleanCode
      });
    } catch (dbErr) {
      console.error('[Supabase Exam Snapshot Exception]:', dbErr.message);
      return res.status(500).json({ error: `Database error fetching exam paper: ${dbErr.message}` });
    }
  } else {
    // Unconfigured local dev mode fallback
    if (!matchedSession) {
      evictExpiredSessions();
      for (const session of activeRollingSessions.values()) {
        const sessionExamId = session.examId || session.exam_id;
        if (examId && sessionExamId !== examId) continue;

        const currentCode = get5MinRollingCode(sessionExamId, 0);
        const previousCode = get5MinRollingCode(sessionExamId, -1);

        if (cleanCode === currentCode || cleanCode === previousCode || cleanCode === session.rollingCode) {
          matchedSession = session;
          targetExamId = sessionExamId;
          break;
        }
      }
    }

    if (!matchedSession) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired 6-Digit Passcode. Rolling codes automatically refresh every 5 minutes. Please ask your instructor for the current passcode.'
      });
    }

    if (!targetExamId) {
      return res.status(400).json({ error: 'Exam target ID could not be identified.' });
    }

    const list = readExamsLocal();
    const localExam = list.find(e => e.id === targetExamId);

    if (!localExam) {
      return res.status(404).json({ error: 'Exam paper snapshot not found or link has expired.' });
    }

    if (localExam.status === 'closed') {
      return res.status(403).json({
        success: false,
        error: 'This exam has been closed by the instructor.'
      });
    }

    return res.json({
      success: true,
      exam: localExam,
      studentName: studentName.trim(),
      rollingCodeUsed: cleanCode
    });
  }
});

/**
 * PUBLIC Student Endpoint: GET /api/exams/:id
 * Strictly verifies 6-Digit Rolling Code via header (x-rolling-code) or query parameter (?code=123456)
 */
router.get('/exams/:id', async (req, res) => {
  const targetId = req.params.id;
  const providedCode = (req.headers['x-rolling-code'] || req.query.code || '').toString().trim();

  if (!providedCode) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Valid 6-digit Rolling Passcode is required to view this exam paper.'
    });
  }

  // Validate passcode against current or grace 5-minute window
  const currentCode = get5MinRollingCode(targetId, 0);
  const graceCode = get5MinRollingCode(targetId, -1);

  let isValidCode = (providedCode === currentCode || providedCode === graceCode);

  if (isConfigured()) {
    if (!isValidCode) {
      try {
        const { data } = await supabase
          .from('exam_sessions')
          .select('rolling_code')
          .eq('exam_id', targetId)
          .eq('is_active', true);
        if (Array.isArray(data) && data.some(s => s.rolling_code === providedCode)) {
          isValidCode = true;
        }
      } catch (e) {}
    }

    if (!isValidCode) {
      for (const session of activeRollingSessions.values()) {
        if ((session.examId || session.exam_id) === targetId && session.rollingCode === providedCode) {
          isValidCode = true;
          break;
        }
      }
    }

    if (!isValidCode) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired 6-digit Rolling Passcode.'
      });
    }

    try {
      const { data, error } = await supabase
        .from('exams')
        .select('snapshot_data, status')
        .eq('id', targetId)
        .single();

      if (error || !data || !data.snapshot_data) {
        return res.status(404).json({ error: 'Exam paper snapshot not found or link has expired.' });
      }

      if (data.status === 'closed') {
        return res.status(403).json({
          success: false,
          isClosed: true,
          error: 'This exam has been closed by the instructor.'
        });
      }

      return res.json({ success: true, exam: data.snapshot_data });
    } catch (e) {
      console.error('[Supabase Exam Fetch Exception]:', e.message);
      return res.status(500).json({ error: `Database error fetching exam: ${e.message}` });
    }
  } else {
    // Unconfigured local dev mode fallback
    if (!isValidCode) {
      for (const session of activeRollingSessions.values()) {
        if ((session.examId || session.exam_id) === targetId && session.rollingCode === providedCode) {
          isValidCode = true;
          break;
        }
      }
    }

    if (!isValidCode) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired 6-digit Rolling Passcode.'
      });
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
  }
});

/**
 * PROTECTED Teacher Endpoint: PATCH /api/exams/:id/status
 * Close or reopen an exam.
 */
router.patch('/exams/:id/status', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  const targetId = req.params.id;
  const { status } = req.body || {};

  const validStatuses = ['active', 'closed', 'draft', 'archived'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  if (isConfigured()) {
    const userDb = createUserClient(req.accessToken);
    try {
      const { error: updateErr } = await userDb
        .from('exams')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', targetId);

      if (updateErr) {
        console.error('[Supabase Exam Status Update Error]:', updateErr.message);
        return res.status(500).json({ error: `Failed to update exam status in database: ${updateErr.message}` });
      }

      return res.json({ success: true, examId: targetId, status });
    } catch (dbErr) {
      console.error('[Supabase Exam Status Update Exception]:', dbErr.message);
      return res.status(500).json({ error: `Database error updating exam status: ${dbErr.message}` });
    }
  } else {
    // Unconfigured local dev mode fallback
    const list = readExamsLocal();
    const examIdx = list.findIndex(e => e.id === targetId);
    if (examIdx !== -1) {
      list[examIdx].status = status;
      writeExamsLocal(list);
    }

    return res.json({ success: true, examId: targetId, status });
  }
});

module.exports = router;
