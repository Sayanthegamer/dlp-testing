const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  supabase,
  getAdminClient,
  isConfigured,
  createUserClient,
  isValidUuid,
} = require('../services/supabaseClient');
const {
  verifyTeacherAuth,
  isDemoOrFallbackAllowed,
} = require('../services/authService');
const {
  readExamsLocal,
  readSubmissionsLocal,
  writeSubmissionsLocal,
} = require('../services/localStoreService');
const { autoEnrollStudentWithExamTeacher, getJwtSecret } = require('../services/studentAuthService');
const { evaluateQuestion, gradeAttempt } = require('../services/gradingService');

function extractVerifiedStudentFromHeader(req) {
  const authHeader = (req && req.headers && req.headers['authorization']) || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    if (decoded && decoded.role === 'student' && decoded.studentId) {
      return decoded;
    }
  } catch (_) {}
  return null;
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

function resolveSubmissionStudentId({ verifiedJwtStudent, isDevDemo, requestedStudentId }) {
  if (verifiedJwtStudent?.studentId) {
    return verifiedJwtStudent.studentId;
  }
  if (isDevDemo) {
    return 'dev_demo_candidate';
  }
  return isDemoOrFallbackAllowed() ? requestedStudentId || null : null;
}

/**
 * PUBLIC / STUDENT Endpoint: POST /api/submissions
 * - Resolves the exact target exam (never reassigns to a random newest exam).
 * - Loads the canonical published question snapshot from the server and computes grades server-side.
 * - Rejects closed or missing exams and returns explicit 500 errors if persistence fails.
 */
router.post('/submissions', async (req, res) => {
  const body = req.body || {};
  const verifiedJwtStudent = extractVerifiedStudentFromHeader(req);

  const studentAnswers =
    body.studentAnswers && typeof body.studentAnswers === 'object' ? body.studentAnswers : {};
  const rawExamId = typeof body.examId === 'string' ? body.examId.trim() : '';
  const rollingCodeUsed = typeof body.rollingCodeUsed === 'string' ? body.rollingCodeUsed.trim() : '';

  const requestedStudentId = body.studentId || body.student_id || null;
  const isRequestedDemo = Boolean(
    body.isDevDemo || body.is_dev_demo || requestedStudentId === 'dev_demo_candidate'
  );

  // Demo mode is only honored if explicitly permitted or running against the sample practice paper in non-prod
  const isDevDemo = isRequestedDemo && isDemoOrFallbackAllowed();
  if (isRequestedDemo && !isDemoOrFallbackAllowed()) {
    return res.status(403).json({
      error: 'Demo submissions are disabled in production. Please sign in with a valid student account.',
    });
  }

  if (!isConfigured() && !isDemoOrFallbackAllowed()) {
    return res.status(503).json({
      error: 'Database persistence is not configured in production.',
    });
  }

  const effectiveStudentId = resolveSubmissionStudentId({
    verifiedJwtStudent,
    isDevDemo,
    requestedStudentId,
  });

  const rawStudentName = verifiedJwtStudent?.fullName
    ? verifiedJwtStudent.fullName
    : typeof body.studentName === 'string' && body.studentName.trim()
    ? body.studentName.trim()
    : 'Candidate';

  const studentName = rawStudentName.substring(0, 100);
  const serverGeneratedId = `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const submittedAt = new Date().toISOString();

  if (isConfigured()) {
    const db = getAdminClient() || supabase;
    let targetExamId = rawExamId && rawExamId !== 'exam_default' ? rawExamId : null;

    // 1. If examId was omitted, resolve strictly via an active rolling session code
    if (!targetExamId && rollingCodeUsed) {
      const { data: sessionMatch, error: sessionErr } = await db
        .from('exam_sessions')
        .select('exam_id, is_active')
        .eq('rolling_code', rollingCodeUsed)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionErr) {
        return res.status(500).json({ error: `Failed to verify exam session: ${sessionErr.message}` });
      }
      if (sessionMatch?.exam_id) {
        targetExamId = sessionMatch.exam_id;
      }
    }

    if (!targetExamId) {
      return res.status(400).json({
        error: 'A valid examId or active rolling session code is required to submit an attempt.',
      });
    }

    // 2. Load the canonical exam and its published question snapshot from the database
    const { data: existingExam, error: examLookupErr } = await db
      .from('exams')
      .select('id, title, status, snapshot_data')
      .eq('id', targetExamId)
      .maybeSingle();

    if (examLookupErr) {
      return res.status(500).json({ error: `Database error loading exam: ${examLookupErr.message}` });
    }
    if (!existingExam) {
      return res.status(404).json({ error: `Exam '${targetExamId}' not found.` });
    }
    if (existingExam.status === 'closed') {
      return res.status(403).json({
        error: 'This exam has been closed by the instructor and no longer accepts submissions.',
      });
    }

    const snapshot = parseSnapshot(existingExam.snapshot_data) || {};
    const canonicalQuestions = Array.isArray(snapshot.questions) ? snapshot.questions : [];
    if (canonicalQuestions.length === 0) {
      return res.status(422).json({
        error: 'Exam has no published question snapshot to grade against.',
      });
    }

    // 3. Verify student existence & compute server-controlled attempt number
    let verifiedStudentId = null;
    let attemptNumber = 1;

    if (!isDevDemo) {
      if (!effectiveStudentId) {
        return res.status(401).json({
          error: 'Student authentication is required to submit an official exam attempt.',
        });
      }

      const { data: existingStudent, error: studentErr } = await db
        .from('students')
        .select('id, full_name')
        .eq('id', effectiveStudentId)
        .maybeSingle();

      if (studentErr) {
        return res.status(500).json({
          error: `Database error verifying student record: ${studentErr.message}`,
        });
      }
      if (!existingStudent?.id) {
        return res.status(403).json({
          error: 'Registered student record not found. Please sign in before submitting.',
        });
      }
      verifiedStudentId = existingStudent.id;

      const { count: priorAttempts, error: countErr } = await db
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('exam_id', targetExamId)
        .eq('student_id', verifiedStudentId);

      if (!countErr && typeof priorAttempts === 'number') {
        attemptNumber = priorAttempts + 1;
      }
    }

    // 4. Compute authoritative grade server-side from canonical questions + studentAnswers
    const graded = gradeAttempt(canonicalQuestions, studentAnswers);
    const cheatingFlagged = Boolean(body.cheatingFlagged);
    const autoGraded = cheatingFlagged
      ? { score: 0, total: canonicalQuestions.length, percentage: 0 }
      : graded.autoGraded;
    const pendingCount = cheatingFlagged ? 0 : graded.pendingReview.length;
    const testTitle = existingExam.title || snapshot.testTitle || 'Mathematics Examination';

    const displayStudentName =
      isDevDemo && !studentName.startsWith('[Dev Demo]')
        ? `[Dev Demo] ${studentName}`
        : studentName;

    const submissionObj = {
      id: serverGeneratedId,
      examId: targetExamId,
      studentId: verifiedStudentId || (isDevDemo ? 'dev_demo_candidate' : null),
      isDevDemo,
      attemptNumber,
      testTitle,
      studentName: displayStudentName,
      rollingCodeUsed,
      submittedAt,
      autoGraded,
      pendingCount,
      perQuestion: graded.perQuestion,
      status: pendingCount > 0 ? 'pending_review' : 'reviewed',
      questions: canonicalQuestions,
      studentAnswers,
      cheatingFlagged,
      cheatingReason: body.cheatingReason || '',
      manualGrades: {},
      finalScore: {
        score: autoGraded.score,
        total: canonicalQuestions.length,
        percentage: autoGraded.percentage,
      },
    };

    const insertPayload = {
      id: serverGeneratedId,
      exam_id: targetExamId,
      student_id: verifiedStudentId,
      student_name: submissionObj.studentName,
      rolling_code_used: rollingCodeUsed,
      total_score: autoGraded.score,
      max_possible: canonicalQuestions.length,
      percentage: autoGraded.percentage,
      time_taken_seconds: Number(body.timeTakenSeconds) || 0,
      is_dev_demo: isDevDemo,
      attempt_number: attemptNumber,
      responses: submissionObj,
      submitted_at: submittedAt,
    };

    const { error: insertError } = await db.from('submissions').insert(insertPayload);
    if (insertError) {
      return res.status(500).json({
        error: `Failed to save submission to database: ${insertError.message}`,
      });
    }

    if (verifiedStudentId && targetExamId && !isDevDemo) {
      try {
        await autoEnrollStudentWithExamTeacher({
          studentId: verifiedStudentId,
          examId: targetExamId,
          source: 'live_exam',
        });
      } catch (enrollErr) {
        console.warn('[Auto-enroll student warning]:', enrollErr.message);
      }
    }

    return res.json({
      success: true,
      submissionId: serverGeneratedId,
      status: submissionObj.status,
      submission: submissionObj,
    });
  }

  // Local development / test mode (only when Supabase is unconfigured)
  if (!isDemoOrFallbackAllowed()) {
    return res.status(503).json({
      error: 'Database persistence is not configured in production.',
    });
  }

  const localExams = readExamsLocal();
  let targetExam = null;

  if (rawExamId && rawExamId !== 'exam_default') {
    targetExam = localExams.find((e) => e.id === rawExamId);
    if (!targetExam) {
      return res.status(404).json({ error: `Exam '${rawExamId}' not found.` });
    }
    if (targetExam.status === 'closed') {
      return res.status(403).json({
        error: 'This exam has been closed by the instructor and no longer accepts submissions.',
      });
    }
  } else if (rollingCodeUsed) {
    targetExam = localExams.find(
      (e) => e.rollingCode === rollingCodeUsed || e.sessionMeta?.rollingCode === rollingCodeUsed
    );
    if (targetExam && targetExam.status === 'closed') {
      return res.status(403).json({
        error: 'This exam has been closed by the instructor and no longer accepts submissions.',
      });
    }
  }

  const canonicalQuestions = Array.isArray(targetExam?.questions)
    ? targetExam.questions
    : Array.isArray(body.questions)
    ? body.questions
    : null;

  if (!Array.isArray(canonicalQuestions) || canonicalQuestions.length === 0) {
    return res.status(400).json({
      error: 'Invalid submission: no published exam questions found to grade.',
    });
  }

  const graded = gradeAttempt(canonicalQuestions, studentAnswers);
  const cheatingFlagged = Boolean(body.cheatingFlagged);
  const autoGraded = cheatingFlagged
    ? { score: 0, total: canonicalQuestions.length, percentage: 0 }
    : graded.autoGraded;
  const pendingCount = cheatingFlagged ? 0 : graded.pendingReview.length;
  const testTitle =
    targetExam?.testTitle ||
    targetExam?.title ||
    (typeof body.testTitle === 'string' && body.testTitle.trim()
      ? body.testTitle.trim().substring(0, 200)
      : 'Mathematics Examination');

  const localList = readSubmissionsLocal();
  const effectiveExamId = targetExam?.id || rawExamId || 'exam_default';
  const priorCount = effectiveStudentId
    ? localList.filter(
        (s) =>
          (s.examId === effectiveExamId || s.exam_id === effectiveExamId) &&
          (s.studentId === effectiveStudentId || s.student_id === effectiveStudentId)
      ).length
    : 0;
  const attemptNumber = priorCount + 1;

  const submissionObj = {
    id: serverGeneratedId,
    examId: effectiveExamId,
    studentId: effectiveStudentId,
    isDevDemo,
    attemptNumber,
    testTitle,
    studentName,
    rollingCodeUsed,
    submittedAt,
    autoGraded,
    pendingCount,
    perQuestion: graded.perQuestion,
    status: pendingCount > 0 ? 'pending_review' : 'reviewed',
    questions: canonicalQuestions,
    studentAnswers,
    cheatingFlagged,
    cheatingReason: body.cheatingReason || '',
    manualGrades: {},
    finalScore: {
      score: autoGraded.score,
      total: canonicalQuestions.length,
      percentage: autoGraded.percentage,
    },
  };

  localList.unshift(submissionObj);
  const savedOk = writeSubmissionsLocal(localList);
  if (!savedOk) {
    return res.status(500).json({ error: 'Failed to persist submission to local storage.' });
  }

  if (effectiveStudentId && targetExam?.id && !isDevDemo) {
    try {
      await autoEnrollStudentWithExamTeacher({
        studentId: effectiveStudentId,
        examId: targetExam.id,
        source: 'live_exam',
      });
    } catch (_) {}
  }

  return res.json({
    success: true,
    submissionId: serverGeneratedId,
    status: submissionObj.status,
    submission: submissionObj,
  });
});

/**
 * PROTECTED Teacher Endpoint: GET /api/submissions
 * Strictly scoped to the authenticated teacher's exams and fails explicitly on database errors.
 */
router.get('/submissions', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  let allSubmissions = [];

  if (isConfigured()) {
    const db = createUserClient(req.accessToken) || getAdminClient() || supabase;
    const teacherUuid = isValidUuid(req.user?.id) ? req.user.id : null;

    if (!teacherUuid && !isDemoOrFallbackAllowed()) {
      return res.status(403).json({ error: 'Valid teacher account required to view submissions.' });
    }

    let query = db
      .from('submissions')
      .select(
        'id, exam_id, student_id, student_name, percentage, total_score, max_possible, responses, submitted_at, exams!inner(teacher_id)'
      )
      .order('submitted_at', { ascending: false });

    if (teacherUuid) {
      query = query.eq('exams.teacher_id', teacherUuid);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({
        error: `Failed to fetch submissions from database: ${error.message}`,
      });
    }
    allSubmissions = Array.isArray(data) ? data : [];
  } else {
    if (!isDemoOrFallbackAllowed()) {
      return res.status(503).json({ error: 'Database persistence is not configured in production.' });
    }
    allSubmissions = readSubmissionsLocal();
  }

  const formatted = allSubmissions.map((item) => {
    if (item.responses) {
      const resp = typeof item.responses === 'string' ? JSON.parse(item.responses) : item.responses;
      return {
        ...resp,
        id: item.id || resp.id,
        examId: item.exam_id || resp.examId,
        studentId: item.student_id || resp.studentId,
        studentName: item.student_name || resp.studentName,
        percentage: item.percentage ?? resp.finalScore?.percentage,
        totalScore: item.total_score ?? resp.finalScore?.score,
        submittedAt: item.submitted_at || resp.submittedAt,
      };
    }
    return item;
  });

  return res.json({ success: true, submissions: formatted });
});

/**
 * PROTECTED Teacher Endpoint: POST /api/submissions/:id/grade
 * Verifies teacher ownership and returns HTTP 500 if persistence fails (never reports false success).
 */
router.post('/submissions/:id/grade', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  const targetId = req.params.id;
  const { manualGrades } = req.body || {};

  if (!manualGrades || typeof manualGrades !== 'object') {
    return res.status(400).json({ error: 'manualGrades object required' });
  }

  let submissionTarget = null;
  let dbClient = null;
  let localList = [];
  let localIdx = -1;

  if (isConfigured()) {
    dbClient = createUserClient(req.accessToken) || getAdminClient() || supabase;
    const teacherUuid = isValidUuid(req.user?.id) ? req.user.id : null;

    if (!teacherUuid && !isDemoOrFallbackAllowed()) {
      return res.status(403).json({ error: 'Valid teacher account required to grade submissions.' });
    }

    const { data: rowData, error: fetchErr } = await dbClient
      .from('submissions')
      .select('id, exam_id, responses, exams(teacher_id)')
      .eq('id', targetId)
      .maybeSingle();

    if (fetchErr) {
      return res.status(500).json({
        error: `Database error loading submission '${targetId}': ${fetchErr.message}`,
      });
    }
    if (!rowData || !rowData.responses) {
      return res.status(404).json({ error: `Submission '${targetId}' not found.` });
    }

    if (
      teacherUuid &&
      (rowData.exams?.teacher_id
        ? rowData.exams.teacher_id !== teacherUuid
        : !isDemoOrFallbackAllowed())
    ) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to grade a submission for another teacher’s exam.',
      });
    }

    submissionTarget =
      typeof rowData.responses === 'string' ? JSON.parse(rowData.responses) : rowData.responses;
  } else {
    if (!isDemoOrFallbackAllowed()) {
      return res.status(503).json({ error: 'Database persistence is not configured in production.' });
    }
    localList = readSubmissionsLocal();
    localIdx = localList.findIndex(
      (s) => s.id === targetId || (s.responses && s.responses.id === targetId)
    );

    if (localIdx >= 0) {
      const item = localList[localIdx];
      submissionTarget = item.responses
        ? typeof item.responses === 'string'
          ? JSON.parse(item.responses)
          : item.responses
        : item;
    }
  }

  if (!submissionTarget) {
    return res.status(404).json({ error: `Submission '${targetId}' not found.` });
  }

  submissionTarget.manualGrades = {
    ...submissionTarget.manualGrades,
    ...manualGrades,
  };

  // Recompute totalScore across all questions (honoring manual overrides over auto-graded items)
  const questions = Array.isArray(submissionTarget.questions) ? submissionTarget.questions : [];
  const studentAnswers = submissionTarget.studentAnswers || {};
  let totalScore = 0;
  let pendingCount = 0;

  if (questions.length > 0) {
    questions.forEach((q, idx) => {
      const qId = q.id || `q_${idx}`;
      const manual = submissionTarget.manualGrades[qId];
      const autoEval = evaluateQuestion(q, studentAnswers[qId]);
      const effectiveStatus = manual && manual.status ? manual.status : autoEval.status;

      if (effectiveStatus === 'pending_review') {
        pendingCount += 1;
      } else if (effectiveStatus === 'correct') {
        totalScore += typeof manual?.score === 'number' ? manual.score : 1;
      }
    });
  } else {
    totalScore = submissionTarget.autoGraded ? submissionTarget.autoGraded.score || 0 : 0;
    Object.values(submissionTarget.manualGrades).forEach((g) => {
      if (g && g.status === 'correct') {
        totalScore += typeof g.score === 'number' ? g.score : 1;
      }
    });
  }

  const totalQuestions = questions.length;
  const percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

  submissionTarget.pendingCount = pendingCount;
  submissionTarget.finalScore = {
    score: totalScore,
    total: totalQuestions,
    percentage,
  };
  submissionTarget.status = pendingCount > 0 ? 'pending_review' : 'reviewed';
  submissionTarget.reviewedAt = new Date().toISOString();

  if (isConfigured()) {
    const { error: updateErr } = await dbClient
      .from('submissions')
      .update({
        total_score: totalScore,
        percentage,
        responses: submissionTarget,
      })
      .eq('id', targetId);

    if (updateErr) {
      return res.status(500).json({
        error: `Failed to persist updated grade in database: ${updateErr.message}`,
      });
    }
  } else {
    localList[localIdx] = {
      ...localList[localIdx],
      total_score: totalScore,
      percentage,
      responses: submissionTarget,
      ...submissionTarget,
    };
    const savedOk = writeSubmissionsLocal(localList);
    if (!savedOk) {
      return res.status(500).json({
        error: 'Failed to persist updated grade to local storage.',
      });
    }
  }

  return res.json({
    success: true,
    submission: submissionTarget,
  });
});

router.extractVerifiedStudentFromHeader = extractVerifiedStudentFromHeader;
router.resolveSubmissionStudentId = resolveSubmissionStudentId;

module.exports = router;
