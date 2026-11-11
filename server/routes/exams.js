const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  supabase,
  getAdminClient,
  isConfigured,
  createUserClient,
  ensureTeacherProfile,
  isValidUuid,
} = require('../services/supabaseClient');
const {
  verifyTeacherAuth,
  isDemoOrFallbackAllowed,
} = require('../services/authService');
const {
  readExamsLocal,
  writeExamsLocal,
  readSubmissionsLocal,
} = require('../services/localStoreService');
const { autoEnrollStudentWithExamTeacher, getJwtSecret } = require('../services/studentAuthService');
const { sanitizeExamSnapshotForStudent } = require('../services/gradingService');

function extractVerifiedStudentIdFromReq(req) {
  const authHeader = (req && req.headers && req.headers['authorization']) || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      if (decoded && decoded.role === 'student' && decoded.studentId) {
        return decoded.studentId;
      }
    } catch (_) {}
  }
  if (isDemoOrFallbackAllowed()) {
    const fallbackId = req?.body?.studentId || req?.body?.student_id || null;
    return fallbackId && fallbackId !== 'dev_demo_candidate' ? fallbackId : null;
  }
  return null;
}

// In-memory active rolling sessions cache (6-hour TTL so 3-hour exams never expire mid-session)
const activeRollingSessions = new Map();
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

function evictExpiredSessions() {
  const now = Date.now();
  for (const [code, session] of activeRollingSessions) {
    const createdMs = session.createdAt ? new Date(session.createdAt).getTime() : 0;
    if (now - createdMs > SESSION_TTL_MS) {
      activeRollingSessions.delete(code);
    }
  }
}

/**
 * Computes deterministic 6-digit rolling passcode for a 5-minute time bucket (300 seconds).
 * Returns null if no signing secret is configured in production (never falls back to a public literal).
 */
function get5MinRollingCode(examId, windowOffset = 0) {
  if (!examId) return null;
  const rawJwt = typeof process.env.JWT_SECRET === 'string' ? process.env.JWT_SECRET.trim() : '';
  const validJwt =
    rawJwt && !rawJwt.includes('your_jwt_secret') && !rawJwt.includes('placeholder') ? rawJwt : '';
  const secret =
    process.env.APP_PASSWORD ||
    process.env.TEACHER_ACCESS_CODE ||
    validJwt ||
    (isDemoOrFallbackAllowed() ? 'rolling-passcode-secret-key' : '');

  if (!secret) {
    return null;
  }

  const timeBucket = Math.floor(Date.now() / (5 * 60 * 1000)) + windowOffset;
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

function parseSnapshot(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }
  return typeof raw === 'object' ? raw : null;
}

/**
 * PROTECTED Teacher Endpoint: GET /api/exams
 * Strictly scoped to the authenticated teacher's exams and returns 500 on database failure.
 */
router.get('/exams', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  let examList = [];
  let allSubmissions = [];

  if (isConfigured()) {
    const db = createUserClient(req.accessToken) || getAdminClient() || supabase;
    const teacherUuid = isValidUuid(req.user?.id) ? req.user.id : null;

    if (!teacherUuid && !isDemoOrFallbackAllowed()) {
      return res.status(403).json({ error: 'Valid teacher account required to list exams.' });
    }

    let query = db
      .from('exams')
      .select('id, title, question_count, status, created_at, teacher_id')
      .order('created_at', { ascending: false });

    if (teacherUuid) {
      query = query.eq('teacher_id', teacherUuid);
    }

    const { data: examData, error: examError } = await query;
    if (examError) {
      return res.status(500).json({
        error: `Failed to fetch exams from database: ${examError.message}`,
      });
    }
    examList = Array.isArray(examData) ? examData : [];

    if (examList.length > 0) {
      const examIds = examList.map((e) => e.id);
      const { data: subData, error: subError } = await db
        .from('submissions')
        .select('id, exam_id')
        .in('exam_id', examIds);

      if (subError) {
        return res.status(500).json({
          error: `Failed to fetch submission counts from database: ${subError.message}`,
        });
      }
      allSubmissions = Array.isArray(subData) ? subData : [];
    }
  } else {
    if (!isDemoOrFallbackAllowed()) {
      return res.status(503).json({ error: 'Database persistence is not configured in production.' });
    }
    const localExams = readExamsLocal();
    examList = localExams.map((e) => ({
      id: e.id,
      title: e.testTitle || e.title,
      question_count: Array.isArray(e.questions) ? e.questions.length : e.question_count || 0,
      created_at: e.createdAt || e.created_at,
      status: e.status || 'active',
    }));
    allSubmissions = readSubmissionsLocal();
  }

  const submissionCounts = {};
  allSubmissions.forEach((sub) => {
    const resp = sub.responses
      ? typeof sub.responses === 'string'
        ? JSON.parse(sub.responses)
        : sub.responses
      : sub;
    const targetExamId = sub.exam_id || sub.examId || resp.exam_id || resp.examId;
    if (targetExamId && targetExamId !== 'exam_default') {
      submissionCounts[targetExamId] = (submissionCounts[targetExamId] || 0) + 1;
    }
  });

  const formatted = examList.map((e) => ({
    id: e.id,
    testTitle: e.title || e.testTitle,
    questionCount: e.question_count ?? (Array.isArray(e.questions) ? e.questions.length : 0),
    createdAt: e.created_at || e.createdAt,
    status: e.status || 'active',
    submissionCount: submissionCounts[e.id] || 0,
  }));

  return res.json({ success: true, exams: formatted });
});

/**
 * PROTECTED Teacher Endpoint: POST /api/exams/publish
 * Requires teacher ownership (never retries with teacher_id: null on error).
 */
router.post('/exams/publish', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required to publish exams' });
  }

  const { testTitle, questions } = req.body || {};
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Invalid exam snapshot: questions array required' });
  }

  const serverGeneratedId = `exam_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const createdAt = new Date().toISOString();
  const cleanTitle =
    typeof testTitle === 'string' && testTitle.trim() ? testTitle.trim() : 'Mathematics Practice Test';

  const examSnapshot = {
    id: serverGeneratedId,
    testTitle: cleanTitle,
    questions,
    createdAt,
    status: 'active',
  };

  if (isConfigured()) {
    const adminDb = getAdminClient() || supabase;
    const userDb = createUserClient(req.accessToken) || adminDb;
    const teacherUuid = isValidUuid(req.user?.id) ? req.user.id : null;

    if (!teacherUuid && !isDemoOrFallbackAllowed()) {
      return res.status(403).json({
        error: 'A verified teacher account is required to publish an exam in production.',
      });
    }

    try {
      if (teacherUuid) {
        await ensureTeacherProfile(req.user, userDb);
      }

      const examRow = {
        id: serverGeneratedId,
        title: cleanTitle,
        question_count: questions.length,
        status: 'active',
        teacher_id: teacherUuid,
        snapshot_data: examSnapshot,
      };

      const { error: insertErr } = await userDb.from('exams').insert(examRow).select();
      if (insertErr) {
        return res.status(500).json({ error: `Failed to publish exam to database: ${insertErr.message}` });
      }

      const questionRows = questions.map((q, idx) => {
        const validType = ['mcq', 'short_answer_numeric', 'match_following'].includes(q.type)
          ? q.type
          : 'short_answer_numeric';
        return {
          id: `${serverGeneratedId}_${q.id || `q${idx + 1}`}`,
          exam_id: serverGeneratedId,
          question_text: String(q.questionText || `Question ${idx + 1}`),
          type: validType,
          options: Array.isArray(q.options) ? q.options : [],
          correct_answer:
            typeof q.correctAnswer === 'number' && Number.isInteger(q.correctAnswer)
              ? q.correctAnswer
              : null,
          accepted_range: Array.isArray(q.acceptedRange) ? q.acceptedRange : null,
          numerical_confirmed: Boolean(q.numericalConfirmed),
          diagrams: Array.isArray(q.diagrams) ? q.diagrams : [],
          diagram_images: Array.isArray(q.diagramImages) ? q.diagramImages : [],
          diagrams_confirmed: Boolean(q.diagramsConfirmed),
          needs_review: Boolean(q.needsReview),
        };
      });

      const { error: qErr } = await userDb.from('questions').upsert(questionRows, { onConflict: 'id' });
      if (qErr) {
        console.warn('[Questions table sync warning]:', qErr.message);
      }

      return res.json({
        success: true,
        examId: serverGeneratedId,
        testTitle: cleanTitle,
        createdAt,
        status: 'active',
      });
    } catch (dbErr) {
      return res.status(500).json({ error: `Database error publishing exam: ${dbErr.message}` });
    }
  } else {
    if (!isDemoOrFallbackAllowed()) {
      return res.status(503).json({ error: 'Database persistence is not configured in production.' });
    }
    const list = readExamsLocal();
    list.unshift({
      ...examSnapshot,
      teacherId: req.user?.id || req.user?.localId || null,
    });
    const savedOk = writeExamsLocal(list);
    if (!savedOk) {
      return res.status(500).json({ error: 'Failed to persist published exam to local storage.' });
    }

    return res.json({
      success: true,
      examId: serverGeneratedId,
      testTitle: cleanTitle,
      createdAt,
      status: 'active',
    });
  }
});

/**
 * PROTECTED Teacher Endpoint: POST /api/exams/session/start
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
  if (!rollingCode) {
    return res.status(503).json({
      error:
        'Server configuration error: JWT_SECRET, APP_PASSWORD, or TEACHER_ACCESS_CODE is required to generate session passcodes.',
    });
  }
  const secondsRemaining = get5MinSecondsRemaining();
  const createdAt = new Date().toISOString();
  const durationMins = parseInt(req.body.durationMinutes, 10) || 180;
  const startTime = Date.now();

  if (isConfigured()) {
    const adminDb = getAdminClient() || supabase;
    const userDb = createUserClient(req.accessToken) || adminDb;
    if (!userDb) {
      return res.status(500).json({ error: 'Database client initialization failed.' });
    }

    const teacherUuid = isValidUuid(req.user?.id) ? req.user.id : null;
    if (!teacherUuid && !isDemoOrFallbackAllowed()) {
      return res.status(403).json({ error: 'Valid teacher account required to start an exam session.' });
    }

    try {
      if (teacherUuid) {
        await ensureTeacherProfile(req.user, userDb);
      }

      const { data: examData, error: examErr } = await userDb
        .from('exams')
        .select('status, snapshot_data, duration_minutes, teacher_id')
        .eq('id', examId)
        .maybeSingle();

      if (examErr) {
        return res.status(500).json({ error: `Database error verifying exam status: ${examErr.message}` });
      }
      if (!examData) {
        return res.status(404).json({ error: `Exam '${examId}' not found.` });
      }
      if (
        teacherUuid &&
        (examData.teacher_id
          ? examData.teacher_id !== teacherUuid
          : !isDemoOrFallbackAllowed())
      ) {
        return res.status(403).json({ error: 'Forbidden: You do not own this exam.' });
      }
      if (examData.status === 'closed') {
        return res.status(403).json({
          error: 'Cannot start rolling session for a closed exam. Reopen the exam first.',
        });
      }

      await userDb.from('exam_sessions').update({ is_active: false }).eq('exam_id', examId);

      const { error: sessionErr } = await userDb.from('exam_sessions').insert({
        exam_id: examId,
        teacher_id: teacherUuid,
        rolling_code: rollingCode,
        is_active: true,
        expires_at: new Date(startTime + (durationMins + 30) * 60 * 1000).toISOString(),
      });

      if (sessionErr) {
        return res.status(500).json({
          error: `Failed to record active test session in database: ${sessionErr.message}`,
        });
      }

      const existingSnapshot = parseSnapshot(examData.snapshot_data) || {};
      const existingMeta = existingSnapshot.sessionMeta || {};
      const preservedExtended = existingMeta.examId === examId ? existingMeta.extendedMinutes || 0 : 0;
      const preservedStart = existingMeta.startTime || startTime;

      const sessionInfo = {
        examId,
        rollingCode,
        createdAt,
        startTime: preservedStart,
        durationMinutes: durationMins,
        extendedMinutes: preservedExtended,
      };

      const { error: metaUpdateErr } = await userDb
        .from('exams')
        .update({
          duration_minutes: durationMins,
          snapshot_data: {
            ...existingSnapshot,
            sessionMeta: sessionInfo,
          },
          updated_at: createdAt,
        })
        .eq('id', examId);

      if (metaUpdateErr) {
        return res.status(500).json({
          error: `Failed to persist session metadata on exam: ${metaUpdateErr.message}`,
        });
      }

      evictExpiredSessions();
      activeRollingSessions.set(rollingCode, sessionInfo);
      activeRollingSessions.set(examId, sessionInfo);

      return res.json({
        success: true,
        examId,
        rollingCode,
        secondsRemaining,
        intervalMinutes: 5,
        durationMinutes: durationMins,
        extendedMinutes: preservedExtended,
        createdAt,
        message: 'Active 5-minute rolling session code fetched.',
      });
    } catch (dbErr) {
      return res.status(500).json({ error: `Database error starting session: ${dbErr.message}` });
    }
  } else {
    if (!isDemoOrFallbackAllowed()) {
      return res.status(503).json({ error: 'Database persistence is not configured in production.' });
    }
    const list = readExamsLocal();
    const localExam = list.find((e) => e.id === examId);
    if (!localExam) {
      return res.status(404).json({ error: `Exam '${examId}' not found.` });
    }
    if (localExam.status === 'closed') {
      return res.status(403).json({
        error: 'Cannot start rolling session for a closed exam. Reopen the exam first.',
      });
    }

    const sessionInfo = {
      examId,
      rollingCode,
      createdAt,
      startTime,
      durationMinutes: durationMins,
      extendedMinutes: 0,
    };

    localExam.durationMinutes = durationMins;
    localExam.sessionMeta = sessionInfo;
    if (!writeExamsLocal(list)) {
      return res.status(500).json({ error: 'Failed to persist session metadata to local storage.' });
    }

    evictExpiredSessions();
    activeRollingSessions.set(rollingCode, sessionInfo);
    activeRollingSessions.set(examId, sessionInfo);

    return res.json({
      success: true,
      examId,
      rollingCode,
      secondsRemaining,
      intervalMinutes: 5,
      durationMinutes: durationMins,
      extendedMinutes: 0,
      createdAt,
      message: 'Active 5-minute rolling session code fetched.',
    });
  }
});

/**
 * PROTECTED Teacher Endpoint: POST /api/exams/session/extend
 */
router.post('/exams/session/extend', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  const { examId, rollingCode, extraMinutes } = req.body || {};
  if (!examId) {
    return res.status(400).json({ error: 'examId is required to extend session time.' });
  }
  const minutesToAdd = parseInt(extraMinutes, 10) || 5;

  let session = null;
  if (rollingCode && activeRollingSessions.has(rollingCode)) {
    session = activeRollingSessions.get(rollingCode);
  } else if (examId && activeRollingSessions.has(examId)) {
    session = activeRollingSessions.get(examId);
  }

  if (isConfigured()) {
    const db = createUserClient(req.accessToken) || getAdminClient() || supabase;
    const teacherUuid = isValidUuid(req.user?.id) ? req.user.id : null;

    const { data: examData, error: fetchErr } = await db
      .from('exams')
      .select('duration_minutes, snapshot_data, teacher_id')
      .eq('id', examId)
      .maybeSingle();

    if (fetchErr) {
      return res.status(500).json({ error: `Database error loading exam: ${fetchErr.message}` });
    }
    if (!examData) {
      return res.status(404).json({ error: `Exam '${examId}' not found.` });
    }
    if (
      teacherUuid &&
      (examData.teacher_id
        ? examData.teacher_id !== teacherUuid
        : !isDemoOrFallbackAllowed())
    ) {
      return res.status(403).json({ error: 'Forbidden: You do not own this exam.' });
    }

    const existingSnapshot = parseSnapshot(examData.snapshot_data) || {};
    if (!session) {
      session = existingSnapshot.sessionMeta
        ? { ...existingSnapshot.sessionMeta }
        : {
            examId,
            rollingCode: rollingCode || get5MinRollingCode(examId, 0),
            createdAt: new Date().toISOString(),
            startTime: Date.now(),
            durationMinutes: examData.duration_minutes || 180,
            extendedMinutes: 0,
          };
    }

    session.extendedMinutes = (session.extendedMinutes || 0) + minutesToAdd;
    if (rollingCode) activeRollingSessions.set(rollingCode, session);
    activeRollingSessions.set(examId, session);

    const { error: updateErr } = await db
      .from('exams')
      .update({
        snapshot_data: {
          ...existingSnapshot,
          sessionMeta: session,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', examId);

    if (updateErr) {
      return res.status(500).json({
        error: `Failed to persist extended session time: ${updateErr.message}`,
      });
    }
  } else {
    if (!isDemoOrFallbackAllowed()) {
      return res.status(503).json({ error: 'Database persistence is not configured in production.' });
    }
    const list = readExamsLocal();
    const localExam = list.find((e) => e.id === examId);
    if (!localExam) {
      return res.status(404).json({ error: `Exam '${examId}' not found.` });
    }
    if (!session) {
      session = localExam.sessionMeta || {
        examId,
        rollingCode: rollingCode || get5MinRollingCode(examId, 0),
        createdAt: new Date().toISOString(),
        startTime: Date.now(),
        durationMinutes: localExam.durationMinutes || 180,
        extendedMinutes: 0,
      };
    }
    session.extendedMinutes = (session.extendedMinutes || 0) + minutesToAdd;
    localExam.sessionMeta = session;
    if (!writeExamsLocal(list)) {
      return res.status(500).json({ error: 'Failed to persist extended session time to local storage.' });
    }
    if (rollingCode) activeRollingSessions.set(rollingCode, session);
    activeRollingSessions.set(examId, session);
  }

  const totalDuration = (session.durationMinutes || 180) + session.extendedMinutes;

  return res.json({
    success: true,
    examId: session.examId,
    durationMinutes: session.durationMinutes || 180,
    extendedMinutes: session.extendedMinutes,
    addedMinutes: minutesToAdd,
    totalDurationMinutes: totalDuration,
    message: `Extended exam duration by +${minutesToAdd} minutes.`,
  });
});

/**
 * PUBLIC Student Endpoint: GET /api/exams/session/status
 */
router.get('/exams/session/status', async (req, res) => {
  const { examId, rollingCode } = req.query || {};

  let session = null;
  if (rollingCode && activeRollingSessions.has(rollingCode)) {
    session = activeRollingSessions.get(rollingCode);
  } else if (examId && activeRollingSessions.has(examId)) {
    session = activeRollingSessions.get(examId);
  } else if (examId) {
    for (const s of activeRollingSessions.values()) {
      if (s.examId === examId) {
        session = s;
        break;
      }
    }
  }

  if (!session && isConfigured() && examId) {
    const db = getAdminClient() || supabase;
    try {
      const { data: examData } = await db
        .from('exams')
        .select('duration_minutes, snapshot_data')
        .eq('id', examId)
        .maybeSingle();
      const snap = parseSnapshot(examData?.snapshot_data);
      if (snap?.sessionMeta) {
        session = snap.sessionMeta;
        activeRollingSessions.set(examId, session);
        if (session.rollingCode) activeRollingSessions.set(session.rollingCode, session);
      } else if (examData) {
        session = {
          examId,
          durationMinutes: examData.duration_minutes || 180,
          extendedMinutes: 0,
          startTime: Date.now(),
        };
      }
    } catch (_) {}
  } else if (!session && !isConfigured() && examId) {
    const list = readExamsLocal();
    const localExam = list.find((e) => e.id === examId);
    if (localExam?.sessionMeta) {
      session = localExam.sessionMeta;
    }
  }

  const durationMinutes = session?.durationMinutes || 180;
  const extendedMinutes = session?.extendedMinutes || 0;
  const startTime = session?.startTime || Date.now();

  return res.json({
    success: true,
    examId: examId || session?.examId || null,
    durationMinutes,
    extendedMinutes,
    totalDurationMinutes: durationMinutes + extendedMinutes,
    startTime,
    serverTime: Date.now(),
  });
});

/**
 * PUBLIC Student Endpoint: POST /api/exams/student-access
 * Strips answer keys (`correctAnswer` & `acceptedRange`) before sending the exam snapshot to the student client.
 */
router.post('/exams/student-access', async (req, res) => {
  const { studentName, rollingCode, examId } = req.body || {};

  if (!studentName || !studentName.trim()) {
    return res.status(400).json({ error: 'Student Name is required.' });
  }

  const cleanCode = (rollingCode || '').trim();
  if (!cleanCode) {
    return res.status(400).json({ error: 'A valid 6-digit rolling passcode is required to enter this exam.' });
  }

  let matchedSession = null;
  let targetExamId = examId || null;

  if (examId) {
    const current5MinCode = get5MinRollingCode(examId, 0);
    const grace5MinCode = get5MinRollingCode(examId, -1);

    if (cleanCode === current5MinCode || cleanCode === grace5MinCode) {
      matchedSession = { exam_id: examId, rolling_code: cleanCode };
      targetExamId = examId;
    }
  }

  if (isConfigured()) {
    const db = getAdminClient() || supabase;

    if (!matchedSession) {
      try {
        let query = db
          .from('exam_sessions')
          .select('id, exam_id, rolling_code, is_active')
          .eq('is_active', true);

        if (examId) {
          query = query.eq('exam_id', examId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          const matchedItem = data.find((session) => {
            const currentCode = get5MinRollingCode(session.exam_id, 0);
            const previousCode = get5MinRollingCode(session.exam_id, -1);
            return (
              cleanCode === currentCode ||
              cleanCode === previousCode ||
              cleanCode === session.rolling_code
            );
          });

          if (matchedItem) {
            matchedSession = matchedItem;
            targetExamId = matchedItem.exam_id;
          }
        }
      } catch (_) {}
    }

    if (!matchedSession) {
      try {
        const { data: activeExams } = await db
          .from('exams')
          .select('id, status')
          .neq('status', 'closed');

        if (Array.isArray(activeExams)) {
          const foundExam = activeExams.find((e) => {
            if (examId && e.id !== examId) return false;
            const currentCode = get5MinRollingCode(e.id, 0);
            const previousCode = get5MinRollingCode(e.id, -1);
            return cleanCode === currentCode || cleanCode === previousCode;
          });

          if (foundExam) {
            matchedSession = { exam_id: foundExam.id, rolling_code: cleanCode };
            targetExamId = foundExam.id;
          }
        }
      } catch (_) {}
    }

    if (!matchedSession) {
      evictExpiredSessions();
      for (const session of activeRollingSessions.values()) {
        const sessionExamId = session.examId || session.exam_id;
        if (examId && sessionExamId !== examId) continue;

        const currentCode = get5MinRollingCode(sessionExamId, 0);
        const previousCode = get5MinRollingCode(sessionExamId, -1);

        if (
          cleanCode === currentCode ||
          cleanCode === previousCode ||
          cleanCode === session.rollingCode
        ) {
          matchedSession = session;
          targetExamId = sessionExamId;
          break;
        }
      }
    }

    if (!matchedSession) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired 6-digit passcode. Rolling codes refresh every 5 minutes.',
      });
    }

    if (!targetExamId) {
      return res.status(400).json({ error: 'Exam target ID could not be identified.' });
    }

    try {
      const { data, error: examErr } = await db
        .from('exams')
        .select('snapshot_data, status')
        .eq('id', targetExamId)
        .maybeSingle();

      if (examErr || !data || !data.snapshot_data) {
        return res.status(404).json({ error: 'Exam paper snapshot not found or link has expired.' });
      }

      if (data.status === 'closed') {
        return res.status(403).json({
          success: false,
          error: 'This exam has been closed by the instructor.',
        });
      }

      const rawSnapshot = parseSnapshot(data.snapshot_data) || data.snapshot_data;
      const safeSnapshot = sanitizeExamSnapshotForStudent(rawSnapshot);

      const candStudentId = extractVerifiedStudentIdFromReq(req);
      if (candStudentId && targetExamId) {
        try {
          await autoEnrollStudentWithExamTeacher({
            studentId: candStudentId,
            examId: targetExamId,
            source: 'live_exam',
          });
        } catch (_) {}
      }

      return res.json({
        success: true,
        exam: safeSnapshot,
        studentName: studentName.trim(),
        rollingCodeUsed: cleanCode,
      });
    } catch (dbErr) {
      return res.status(500).json({ error: `Database error fetching exam paper: ${dbErr.message}` });
    }
  } else {
    if (!isDemoOrFallbackAllowed()) {
      return res.status(503).json({ error: 'Database persistence is not configured in production.' });
    }
    if (!matchedSession) {
      evictExpiredSessions();
      for (const session of activeRollingSessions.values()) {
        const sessionExamId = session.examId || session.exam_id;
        if (examId && sessionExamId !== examId) continue;

        const currentCode = get5MinRollingCode(sessionExamId, 0);
        const previousCode = get5MinRollingCode(sessionExamId, -1);

        if (
          cleanCode === currentCode ||
          cleanCode === previousCode ||
          cleanCode === session.rollingCode
        ) {
          matchedSession = session;
          targetExamId = sessionExamId;
          break;
        }
      }
    }

    if (!matchedSession) {
      const list = readExamsLocal();
      const matchedLocal = list.find((e) => {
        if (e.status === 'closed') return false;
        if (examId && e.id !== examId) return false;
        const currentCode = get5MinRollingCode(e.id, 0);
        const previousCode = get5MinRollingCode(e.id, -1);
        return (
          cleanCode === currentCode ||
          cleanCode === previousCode ||
          (e.rollingCode && cleanCode === e.rollingCode)
        );
      });

      if (matchedLocal) {
        matchedSession = { exam_id: matchedLocal.id, rolling_code: cleanCode };
        targetExamId = matchedLocal.id;
      }
    }

    if (!matchedSession) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired 6-digit passcode. Rolling codes refresh every 5 minutes.',
      });
    }

    if (!targetExamId) {
      return res.status(400).json({ error: 'Exam target ID could not be identified.' });
    }

    const list = readExamsLocal();
    const localExam = list.find((e) => e.id === targetExamId);

    if (!localExam) {
      return res.status(404).json({ error: 'Exam paper snapshot not found or link has expired.' });
    }

    if (localExam.status === 'closed') {
      return res.status(403).json({
        success: false,
        error: 'This exam has been closed by the instructor.',
      });
    }

    const candStudentId = extractVerifiedStudentIdFromReq(req);
    if (candStudentId && targetExamId) {
      try {
        await autoEnrollStudentWithExamTeacher({
          studentId: candStudentId,
          examId: targetExamId,
          source: 'live_exam',
        });
      } catch (_) {}
    }

    return res.json({
      success: true,
      exam: sanitizeExamSnapshotForStudent(localExam),
      studentName: studentName.trim(),
      rollingCodeUsed: cleanCode,
    });
  }
});

/**
 * PUBLIC Student Endpoint: GET /api/exams/:id
 * Strips answer keys before returning the exam paper to the student client.
 */
router.get('/exams/:id', async (req, res) => {
  const targetId = req.params.id;
  const providedCode = (req.headers['x-rolling-code'] || req.query.code || '').toString().trim();

  if (!providedCode) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Valid 6-digit rolling passcode is required to view this exam paper.',
    });
  }

  const currentCode = get5MinRollingCode(targetId, 0);
  const graceCode = get5MinRollingCode(targetId, -1);

  let isValidCode = Boolean(providedCode) && (providedCode === currentCode || providedCode === graceCode);

  if (isConfigured()) {
    const db = getAdminClient() || supabase;

    if (!isValidCode) {
      try {
        const { data } = await db
          .from('exam_sessions')
          .select('rolling_code')
          .eq('exam_id', targetId)
          .eq('is_active', true);
        if (Array.isArray(data) && data.some((s) => s.rolling_code === providedCode)) {
          isValidCode = true;
        }
      } catch (_) {}
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
        error: 'Invalid or expired 6-digit rolling passcode.',
      });
    }

    try {
      const { data, error } = await db
        .from('exams')
        .select('snapshot_data, status')
        .eq('id', targetId)
        .maybeSingle();

      if (error || !data || !data.snapshot_data) {
        return res.status(404).json({ error: 'Exam paper snapshot not found or link has expired.' });
      }

      if (data.status === 'closed') {
        return res.status(403).json({
          success: false,
          isClosed: true,
          error: 'This exam has been closed by the instructor.',
        });
      }

      const rawSnapshot = parseSnapshot(data.snapshot_data) || data.snapshot_data;
      return res.json({
        success: true,
        exam: sanitizeExamSnapshotForStudent(rawSnapshot),
      });
    } catch (e) {
      return res.status(500).json({ error: `Database error fetching exam: ${e.message}` });
    }
  } else {
    if (!isDemoOrFallbackAllowed()) {
      return res.status(503).json({ error: 'Database persistence is not configured in production.' });
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
        error: 'Invalid or expired 6-digit rolling passcode.',
      });
    }

    const list = readExamsLocal();
    const exam = list.find((e) => e.id === targetId);

    if (!exam) {
      return res.status(404).json({ error: 'Exam paper snapshot not found or link has expired.' });
    }

    if (exam.status === 'closed') {
      return res.status(403).json({
        success: false,
        isClosed: true,
        error: 'This exam has been closed by the instructor.',
      });
    }

    return res.json({
      success: true,
      exam: sanitizeExamSnapshotForStudent(exam),
    });
  }
});

/**
 * PROTECTED Teacher Endpoint: PATCH /api/exams/:id/status
 * Enforces teacher ownership and returns explicit errors if the update fails.
 */
router.patch('/exams/:id/status', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  const targetId = req.params.id;
  const { status } = req.body || {};

  const validStatuses = ['active', 'closed', 'draft', 'archived', 'published'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  if (isConfigured()) {
    const db = createUserClient(req.accessToken) || getAdminClient() || supabase;
    const teacherUuid = isValidUuid(req.user?.id) ? req.user.id : null;

    if (!teacherUuid && !isDemoOrFallbackAllowed()) {
      return res.status(403).json({ error: 'Valid teacher account required to update exam status.' });
    }

    try {
      const { data: existingExam, error: lookupErr } = await db
        .from('exams')
        .select('id, teacher_id')
        .eq('id', targetId)
        .maybeSingle();

      if (lookupErr) {
        return res.status(500).json({ error: `Database error verifying exam: ${lookupErr.message}` });
      }
      if (!existingExam) {
        return res.status(404).json({ error: `Exam '${targetId}' not found.` });
      }
      if (
        teacherUuid &&
        (existingExam.teacher_id
          ? existingExam.teacher_id !== teacherUuid
          : !isDemoOrFallbackAllowed())
      ) {
        return res.status(403).json({ error: 'Forbidden: You do not own this exam.' });
      }

      const updatedAt = new Date().toISOString();
      const { error: updateErr } = await db
        .from('exams')
        .update({ status, updated_at: updatedAt })
        .eq('id', targetId);

      if (updateErr) {
        return res.status(500).json({ error: `Failed to update exam status in database: ${updateErr.message}` });
      }

      if (status === 'closed') {
        await db.from('exam_sessions').update({ is_active: false }).eq('exam_id', targetId);
      }

      return res.json({ success: true, examId: targetId, status });
    } catch (dbErr) {
      return res.status(500).json({ error: `Database error updating exam status: ${dbErr.message}` });
    }
  } else {
    if (!isDemoOrFallbackAllowed()) {
      return res.status(503).json({ error: 'Database persistence is not configured in production.' });
    }
    const list = readExamsLocal();
    const examIdx = list.findIndex((e) => e.id === targetId);
    if (examIdx === -1) {
      return res.status(404).json({ error: `Exam '${targetId}' not found.` });
    }
    list[examIdx].status = status;
    if (!writeExamsLocal(list)) {
      return res.status(500).json({ error: 'Failed to persist updated exam status to local storage.' });
    }

    return res.json({ success: true, examId: targetId, status });
  }
});

router.get5MinRollingCode = get5MinRollingCode;

module.exports = router;
