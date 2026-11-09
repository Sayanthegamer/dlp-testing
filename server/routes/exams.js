const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const {
  supabase,
  getAdminClient,
  isConfigured,
  createUserClient,
  ensureTeacherProfile,
  isValidUuid,
} = require('../services/supabaseClient');
const { verifyTeacherAuth } = require('../services/authService');
const {
  readExamsLocal,
  writeExamsLocal,
  readSubmissionsLocal,
} = require('../services/localStoreService');
const { autoEnrollStudentWithExamTeacher } = require('../services/studentAuthService');

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
 */
function get5MinRollingCode(examId, windowOffset = 0) {
  if (!examId) return '849201';
  const timeBucket = Math.floor(Date.now() / (5 * 60 * 1000)) + windowOffset;
  const secret = process.env.APP_PASSWORD || process.env.TEACHER_ACCESS_CODE || 'rolling-passcode-secret-key';
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
 * Uses Supabase exclusively when configured; falls back to local store only in test/unconfigured mode.
 */
router.get('/exams', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  let examList = [];
  let allSubmissions = [];

  if (isConfigured()) {
    const adminDb = getAdminClient() || supabase;
    const userDb = createUserClient(req.accessToken) || adminDb;
    const teacherUuid = isValidUuid(req.user?.id) ? req.user.id : null;

    try {
      let query = userDb
        .from('exams')
        .select('id, title, question_count, status, created_at, teacher_id')
        .order('created_at', { ascending: false });

      if (teacherUuid) {
        query = query.or(`teacher_id.eq.${teacherUuid},teacher_id.is.null`);
      }

      const { data: userData, error: userError } = await query;

      if (!userError && Array.isArray(userData)) {
        examList = userData;
      } else if (adminDb) {
        let adminQuery = adminDb
          .from('exams')
          .select('id, title, question_count, status, created_at, teacher_id')
          .order('created_at', { ascending: false });

        if (teacherUuid) {
          adminQuery = adminQuery.or(`teacher_id.eq.${teacherUuid},teacher_id.is.null`);
        }

        const { data: adminData } = await adminQuery;
        if (Array.isArray(adminData)) {
          examList = adminData;
        }
      }
    } catch (e) {
      console.error('[Supabase Exams Fetch Exception]:', e.message);
    }

    try {
      const { data: userSubs, error: subErr } = await userDb
        .from('submissions')
        .select('id, exam_id, responses');
      if (!subErr && Array.isArray(userSubs)) {
        allSubmissions = userSubs;
      } else if (adminDb) {
        const { data: adminSubs } = await adminDb
          .from('submissions')
          .select('id, exam_id, responses');
        if (Array.isArray(adminSubs)) {
          allSubmissions = adminSubs;
        }
      }
    } catch (_) {}
  } else {
    const localExams = readExamsLocal();
    examList = localExams.map(e => ({
      id: e.id,
      title: e.testTitle || e.title,
      question_count: Array.isArray(e.questions) ? e.questions.length : (e.question_count || 0),
      created_at: e.createdAt || e.created_at,
      status: e.status || 'active',
    }));
    allSubmissions = readSubmissionsLocal();
  }

  // Calculate submission count per exam ID
  const submissionCounts = {};
  const singleActiveExamId = examList.length === 1 ? examList[0].id : null;

  allSubmissions.forEach(sub => {
    const resp = sub.responses
      ? typeof sub.responses === 'string'
        ? JSON.parse(sub.responses)
        : sub.responses
      : sub;
    const targetExamId = sub.exam_id || sub.examId || resp.exam_id || resp.examId;

    if (targetExamId && targetExamId !== 'exam_default') {
      submissionCounts[targetExamId] = (submissionCounts[targetExamId] || 0) + 1;
    } else if (singleActiveExamId) {
      submissionCounts[singleActiveExamId] = (submissionCounts[singleActiveExamId] || 0) + 1;
    }
  });

  const formatted = examList.map(e => ({
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

      let { error: insertErr } = await userDb.from('exams').insert(examRow).select();

      // Fallback to admin client if RLS or non-existent teacher profile rejected the insert
      if (insertErr && adminDb && adminDb !== userDb) {
        const retryRes = await adminDb.from('exams').insert(examRow).select();
        insertErr = retryRes.error;
      }

      // If foreign key on teacher_id still failed, retry with teacher_id: null
      if (insertErr && teacherUuid) {
        const retryNullTeacher = await (adminDb || userDb)
          .from('exams')
          .insert({ ...examRow, teacher_id: null })
          .select();
        insertErr = retryNullTeacher.error;
      }

      if (insertErr) {
        return res.status(500).json({ error: `Failed to publish exam to database: ${insertErr.message}` });
      }

      // Best-effort sync of normalized question records into `public.questions` table
      try {
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
        await (adminDb || userDb).from('questions').upsert(questionRows, { onConflict: 'id' });
      } catch (_) {}

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
    const list = readExamsLocal();
    list.unshift(examSnapshot);
    writeExamsLocal(list);

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

    try {
      if (teacherUuid) {
        await ensureTeacherProfile(req.user, userDb);
      }

      let { data: examData, error: examErr } = await userDb
        .from('exams')
        .select('status, snapshot_data, duration_minutes')
        .eq('id', examId)
        .maybeSingle();

      if ((examErr || !examData) && adminDb && adminDb !== userDb) {
        const adminLookup = await adminDb
          .from('exams')
          .select('status, snapshot_data, duration_minutes')
          .eq('id', examId)
          .maybeSingle();
        examData = adminLookup.data;
        examErr = adminLookup.error;
      }

      if (examErr) {
        return res.status(500).json({ error: `Database error verifying exam status: ${examErr.message}` });
      }
      if (!examData) {
        return res.status(404).json({ error: `Exam '${examId}' not found.` });
      }
      if (examData.status === 'closed') {
        return res.status(403).json({
          error: 'Cannot start rolling session for a closed exam. Reopen the exam first.',
        });
      }

      const dbWriter = adminDb || userDb;
      await dbWriter.from('exam_sessions').update({ is_active: false }).eq('exam_id', examId);

      let { error: sessionErr } = await dbWriter.from('exam_sessions').insert({
        exam_id: examId,
        teacher_id: teacherUuid,
        rolling_code: rollingCode,
        is_active: true,
        expires_at: new Date(startTime + (durationMins + 30) * 60 * 1000).toISOString(),
      });

      // If teacher_id FK constraint fails (e.g., teacher row missing in public.teachers), retry with null teacher_id
      if (sessionErr && teacherUuid) {
        const retrySession = await dbWriter.from('exam_sessions').insert({
          exam_id: examId,
          teacher_id: null,
          rolling_code: rollingCode,
          is_active: true,
          expires_at: new Date(startTime + (durationMins + 30) * 60 * 1000).toISOString(),
        });
        sessionErr = retrySession.error;
      }

      if (sessionErr) {
        return res.status(500).json({
          error: `Failed to record active test session in database: ${sessionErr.message}`,
        });
      }

      // Persist session timing metadata inside exams.duration_minutes & snapshot_data.sessionMeta
      // so serverless functions share duration and live time extensions across instances
      const existingSnapshot = parseSnapshot(examData.snapshot_data) || {};
      const existingMeta = existingSnapshot.sessionMeta || {};
      const preservedExtended = existingMeta.examId === examId ? (existingMeta.extendedMinutes || 0) : 0;
      const preservedStart = existingMeta.startTime || startTime;

      const sessionInfo = {
        examId,
        rollingCode,
        createdAt,
        startTime: preservedStart,
        durationMinutes: durationMins,
        extendedMinutes: preservedExtended,
      };

      try {
        await dbWriter
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
      } catch (_) {}

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
    const list = readExamsLocal();
    const localExam = list.find(e => e.id === examId);
    if (localExam && localExam.status === 'closed') {
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

    if (localExam) {
      localExam.durationMinutes = durationMins;
      localExam.sessionMeta = sessionInfo;
      writeExamsLocal(list);
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
 * Persists extended time both in memory and in Supabase `exams.snapshot_data.sessionMeta` for serverless durability.
 */
router.post('/exams/session/extend', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  const { examId, rollingCode, extraMinutes } = req.body || {};
  const minutesToAdd = parseInt(extraMinutes, 10) || 5;

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

  // Hydrate from Supabase if this serverless instance did not have the session cached in memory
  if (!session && isConfigured() && examId) {
    const db = getAdminClient() || createUserClient(req.accessToken) || supabase;
    try {
      const { data: examData } = await db
        .from('exams')
        .select('duration_minutes, snapshot_data')
        .eq('id', examId)
        .maybeSingle();
      const snap = parseSnapshot(examData?.snapshot_data);
      if (snap?.sessionMeta) {
        session = { ...snap.sessionMeta };
      } else if (examData) {
        session = {
          examId,
          rollingCode: rollingCode || get5MinRollingCode(examId, 0),
          createdAt: new Date().toISOString(),
          startTime: Date.now(),
          durationMinutes: examData.duration_minutes || 180,
          extendedMinutes: 0,
        };
      }
    } catch (_) {}
  }

  if (!session) {
    session = {
      examId: examId || 'default',
      rollingCode: rollingCode || '000000',
      createdAt: new Date().toISOString(),
      startTime: Date.now(),
      durationMinutes: 180,
      extendedMinutes: 0,
    };
  }

  session.extendedMinutes = (session.extendedMinutes || 0) + minutesToAdd;
  if (rollingCode) activeRollingSessions.set(rollingCode, session);
  if (session.examId) activeRollingSessions.set(session.examId, session);

  // Persist updated sessionMeta to Supabase or local store
  if (isConfigured() && session.examId && session.examId !== 'default') {
    const db = getAdminClient() || createUserClient(req.accessToken) || supabase;
    try {
      const { data: examData } = await db
        .from('exams')
        .select('snapshot_data')
        .eq('id', session.examId)
        .maybeSingle();
      const existingSnapshot = parseSnapshot(examData?.snapshot_data) || {};
      await db
        .from('exams')
        .update({
          snapshot_data: {
            ...existingSnapshot,
            sessionMeta: session,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.examId);
    } catch (_) {}
  } else if (!isConfigured() && session.examId) {
    const list = readExamsLocal();
    const localExam = list.find(e => e.id === session.examId);
    if (localExam) {
      localExam.sessionMeta = session;
      writeExamsLocal(list);
    }
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
 * Reads from memory cache and falls back to Supabase `exams.snapshot_data.sessionMeta` on serverless cold starts.
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
    const localExam = list.find(e => e.id === examId);
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
          const matchedItem = data.find(session => {
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
            targetExamId = matchedSession.exam_id;
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
          const foundExam = activeExams.find(e => {
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

      const snapshot = parseSnapshot(data.snapshot_data) || data.snapshot_data;

      // Auto-enroll registered student with the exam's teacher
      const candStudentId = req.body.studentId || req.body.student_id;
      if (candStudentId && targetExamId) {
        try {
          await autoEnrollStudentWithExamTeacher({ studentId: candStudentId, examId: targetExamId, source: 'live_exam' });
        } catch (_) {}
      }

      return res.json({
        success: true,
        exam: snapshot,
        studentName: studentName.trim(),
        rollingCodeUsed: cleanCode,
      });
    } catch (dbErr) {
      return res.status(500).json({ error: `Database error fetching exam paper: ${dbErr.message}` });
    }
  } else {
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
      const matchedLocal = list.find(e => {
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
    const localExam = list.find(e => e.id === targetExamId);

    if (!localExam) {
      return res.status(404).json({ error: 'Exam paper snapshot not found or link has expired.' });
    }

    if (localExam.status === 'closed') {
      return res.status(403).json({
        success: false,
        error: 'This exam has been closed by the instructor.',
      });
    }

    // Auto-enroll registered student with the exam's teacher in local mode
    const candStudentId = req.body.studentId || req.body.student_id;
    if (candStudentId && targetExamId) {
      try {
        await autoEnrollStudentWithExamTeacher({ studentId: candStudentId, examId: targetExamId, source: 'live_exam' });
      } catch (_) {}
    }

    return res.json({
      success: true,
      exam: localExam,
      studentName: studentName.trim(),
      rollingCodeUsed: cleanCode,
    });
  }
});

/**
 * PUBLIC Student Endpoint: GET /api/exams/:id
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

  let isValidCode = providedCode === currentCode || providedCode === graceCode;

  if (isConfigured()) {
    const db = getAdminClient() || supabase;

    if (!isValidCode) {
      try {
        const { data } = await db
          .from('exam_sessions')
          .select('rolling_code')
          .eq('exam_id', targetId)
          .eq('is_active', true);
        if (Array.isArray(data) && data.some(s => s.rolling_code === providedCode)) {
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

      return res.json({ success: true, exam: parseSnapshot(data.snapshot_data) || data.snapshot_data });
    } catch (e) {
      return res.status(500).json({ error: `Database error fetching exam: ${e.message}` });
    }
  } else {
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
    const exam = list.find(e => e.id === targetId);

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

    return res.json({ success: true, exam });
  }
});

/**
 * PROTECTED Teacher Endpoint: PATCH /api/exams/:id/status
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
    const adminDb = getAdminClient() || supabase;
    const userDb = createUserClient(req.accessToken) || adminDb;
    try {
      const updatedAt = new Date().toISOString();
      let { error: updateErr } = await userDb
        .from('exams')
        .update({ status, updated_at: updatedAt })
        .eq('id', targetId);

      if (updateErr && adminDb && adminDb !== userDb) {
        const retryRes = await adminDb
          .from('exams')
          .update({ status, updated_at: updatedAt })
          .eq('id', targetId);
        updateErr = retryRes.error;
      }

      if (updateErr) {
        return res.status(500).json({ error: `Failed to update exam status in database: ${updateErr.message}` });
      }

      if (status === 'closed') {
        try {
          await (adminDb || userDb)
            .from('exam_sessions')
            .update({ is_active: false })
            .eq('exam_id', targetId);
        } catch (_) {}
      }

      return res.json({ success: true, examId: targetId, status });
    } catch (dbErr) {
      return res.status(500).json({ error: `Database error updating exam status: ${dbErr.message}` });
    }
  } else {
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
