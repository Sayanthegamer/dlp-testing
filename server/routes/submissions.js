const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const {
  supabase,
  getAdminClient,
  isConfigured,
  createUserClient,
} = require('../services/supabaseClient');
const { verifyTeacherAuth } = require('../services/authService');
const {
  readSubmissionsLocal,
  writeSubmissionsLocal,
} = require('../services/localStoreService');
const { autoEnrollStudentWithExamTeacher } = require('../services/studentAuthService');

/**
 * PUBLIC Student Endpoint: POST /api/submissions
 * Persists directly to Supabase when configured; uses local fallback only in test/unconfigured mode.
 * Safely validates `exam_id` and `student_id` foreign keys so demo/practice attempts never fail with FK constraint errors.
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

  const serverGeneratedId = `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const submittedAt = new Date().toISOString();

  const autoGraded = body.autoGraded || { score: 0, total: 0, percentage: 0 };
  const pendingCount = typeof body.pendingCount === 'number' ? body.pendingCount : 0;
  const questions = body.questions || [];
  const studentAnswers = body.studentAnswers || {};
  const rawExamId = (body.examId || '').trim();
  const rollingCodeUsed = (body.rollingCodeUsed || '').trim();

  const studentId = body.studentId || body.student_id || null;
  const isDevDemo = Boolean(body.isDevDemo || body.is_dev_demo || studentId === 'dev_demo_candidate');
  const attemptNumber = typeof body.attemptNumber === 'number' ? body.attemptNumber : 1;

  if (isConfigured()) {
    const db = getAdminClient() || supabase;
    let targetExamId = null;
    let verifiedStudentId = null;

    // 1. Verify studentId exists in public.students before assigning foreign key
    if (studentId && !isDevDemo && studentId !== 'dev_demo_candidate') {
      try {
        const { data: existingStudent } = await db
          .from('students')
          .select('id')
          .eq('id', studentId)
          .maybeSingle();
        if (existingStudent?.id) {
          verifiedStudentId = existingStudent.id;
        }
      } catch (_) {}
    }

    // 2. Resolve targetExamId against public.exams
    if (rawExamId && rawExamId !== 'exam_default') {
      try {
        const { data: existingExam } = await db
          .from('exams')
          .select('id')
          .eq('id', rawExamId)
          .maybeSingle();
        if (existingExam?.id) {
          targetExamId = existingExam.id;
        }
      } catch (_) {}
    }

    if (!targetExamId && rollingCodeUsed) {
      try {
        const { data: sessionMatch } = await db
          .from('exam_sessions')
          .select('exam_id')
          .eq('rolling_code', rollingCodeUsed)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sessionMatch?.exam_id) {
          targetExamId = sessionMatch.exam_id;
        }
      } catch (_) {}
    }

    if (!targetExamId) {
      try {
        const { data: activeExams } = await db
          .from('exams')
          .select('id')
          .neq('status', 'closed')
          .order('created_at', { ascending: false })
          .limit(1);
        if (Array.isArray(activeExams) && activeExams.length > 0) {
          targetExamId = activeExams[0].id;
        }
      } catch (_) {}
    }

    // 3. If no exam exists in public.exams yet (e.g. practice/default paper on a fresh DB),
    // ensure a default exam row exists so `submissions.exam_id NOT NULL REFERENCES exams(id)` never fails
    if (!targetExamId) {
      const fallbackExamId = rawExamId || 'exam_default';
      try {
        await db.from('exams').upsert(
          {
            id: fallbackExamId,
            title: testTitle,
            question_count: questions.length,
            status: 'active',
            teacher_id: null,
            snapshot_data: {
              id: fallbackExamId,
              testTitle,
              questions,
              createdAt: submittedAt,
              status: 'active',
            },
          },
          { onConflict: 'id' }
        );
        targetExamId = fallbackExamId;
      } catch (_) {}
    }

    const displayStudentName =
      isDevDemo && !studentName.startsWith('[Dev Demo]')
        ? `[Dev Demo] ${studentName}`
        : studentName;

    const finalPercentage =
      typeof autoGraded.percentage === 'number'
        ? autoGraded.percentage
        : questions.length > 0
        ? Math.round(((autoGraded.score || 0) / questions.length) * 100)
        : 0;

    const submissionObj = {
      id: serverGeneratedId,
      examId: targetExamId || rawExamId || 'exam_default',
      studentId,
      isDevDemo,
      attemptNumber,
      testTitle,
      studentName: displayStudentName,
      rollingCodeUsed,
      submittedAt,
      autoGraded: {
        score: autoGraded.score || 0,
        total: autoGraded.total ?? questions.length,
        percentage: finalPercentage,
      },
      pendingCount,
      status: pendingCount > 0 ? 'pending_review' : 'reviewed',
      questions,
      studentAnswers,
      cheatingFlagged: Boolean(body.cheatingFlagged),
      cheatingReason: body.cheatingReason || '',
      manualGrades: {},
      finalScore: {
        score: autoGraded.score || 0,
        total: questions.length,
        percentage: finalPercentage,
      },
    };

    try {
      const insertPayload = {
        id: serverGeneratedId,
        student_id: verifiedStudentId,
        student_name: submissionObj.studentName,
        rolling_code_used: rollingCodeUsed,
        total_score: autoGraded.score || 0,
        max_possible: questions.length || 0,
        percentage: finalPercentage,
        time_taken_seconds: body.timeTakenSeconds || 0,
        is_dev_demo: isDevDemo,
        attempt_number: attemptNumber,
        responses: submissionObj,
        submitted_at: submittedAt,
      };
      if (targetExamId) {
        insertPayload.exam_id = targetExamId;
      }

      let { error: insertError } = await db.from('submissions').insert(insertPayload);

      // Resilient retry if student_id foreign key fails
      if (insertError && insertPayload.student_id) {
        const retryWithoutStudentFk = await db
          .from('submissions')
          .insert({ ...insertPayload, student_id: null });
        insertError = retryWithoutStudentFk.error;
      }

      if (insertError) {
        return res.status(500).json({ error: `Failed to save submission to Supabase: ${insertError.message}` });
      }

      // Auto-enroll student with exam's teacher
      const activeStudentId = verifiedStudentId || studentId;
      if (activeStudentId && targetExamId && !isDevDemo) {
        try {
          await autoEnrollStudentWithExamTeacher({ studentId: activeStudentId, examId: targetExamId, source: 'live_exam' });
        } catch (_) {}
      }
    } catch (dbErr) {
      return res.status(500).json({ error: `Database error saving submission: ${dbErr.message}` });
    }

    return res.json({
      success: true,
      submissionId: serverGeneratedId,
      status: submissionObj.status,
    });
  } else {
    const finalPercentage =
      typeof autoGraded.percentage === 'number'
        ? autoGraded.percentage
        : questions.length > 0
        ? Math.round(((autoGraded.score || 0) / questions.length) * 100)
        : 0;

    const submissionObj = {
      id: serverGeneratedId,
      examId: rawExamId || 'exam_default',
      studentId,
      isDevDemo,
      attemptNumber,
      testTitle,
      studentName,
      rollingCodeUsed,
      submittedAt,
      autoGraded: {
        score: autoGraded.score || 0,
        total: autoGraded.total ?? questions.length,
        percentage: finalPercentage,
      },
      pendingCount,
      status: pendingCount > 0 ? 'pending_review' : 'reviewed',
      questions,
      studentAnswers,
      cheatingFlagged: Boolean(body.cheatingFlagged),
      cheatingReason: body.cheatingReason || '',
      manualGrades: {},
      finalScore: {
        score: autoGraded.score || 0,
        total: questions.length,
        percentage: finalPercentage,
      },
    };

    const list = readSubmissionsLocal();
    list.unshift(submissionObj);
    writeSubmissionsLocal(list);

    // Auto-enroll in local dev mode if examId provided
    if (studentId && rawExamId && !isDevDemo) {
      try {
        await autoEnrollStudentWithExamTeacher({ studentId, examId: rawExamId, source: 'live_exam' });
      } catch (_) {}
    }

    return res.json({
      success: true,
      submissionId: serverGeneratedId,
      status: submissionObj.status,
    });
  }
});

/**
 * PROTECTED Teacher Endpoint: GET /api/submissions
 */
router.get('/submissions', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized: Teacher credentials required' });
  }

  let allSubmissions = [];

  if (isConfigured()) {
    const adminDb = getAdminClient() || supabase;
    const userDb = createUserClient(req.accessToken) || adminDb;
    try {
      const { data: userData, error: userError } = await userDb
        .from('submissions')
        .select('id, exam_id, student_id, student_name, percentage, total_score, max_possible, responses, submitted_at')
        .order('submitted_at', { ascending: false });

      if (!userError && Array.isArray(userData)) {
        allSubmissions = userData;
      } else if (adminDb) {
        const { data: adminData } = await adminDb
          .from('submissions')
          .select('id, exam_id, student_id, student_name, percentage, total_score, max_possible, responses, submitted_at')
          .order('submitted_at', { ascending: false });

        if (Array.isArray(adminData)) {
          allSubmissions = adminData;
        }
      }
    } catch (_) {}
  } else {
    allSubmissions = readSubmissionsLocal();
  }

  const formatted = allSubmissions.map(item => {
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
  let clientUsed = null;
  let localList = [];
  let localIdx = -1;

  if (isConfigured()) {
    const adminDb = getAdminClient() || supabase;
    const userDb = createUserClient(req.accessToken) || adminDb;
    try {
      const { data: userData, error: userErr } = await userDb
        .from('submissions')
        .select('responses')
        .eq('id', targetId)
        .maybeSingle();

      if (!userErr && userData && userData.responses) {
        submissionTarget =
          typeof userData.responses === 'string' ? JSON.parse(userData.responses) : userData.responses;
        clientUsed = userDb;
      } else if (adminDb) {
        const { data: adminData, error: adminErr } = await adminDb
          .from('submissions')
          .select('responses')
          .eq('id', targetId)
          .maybeSingle();

        if (!adminErr && adminData && adminData.responses) {
          submissionTarget =
            typeof adminData.responses === 'string' ? JSON.parse(adminData.responses) : adminData.responses;
          clientUsed = adminDb;
        }
      }
    } catch (_) {}
  } else {
    localList = readSubmissionsLocal();
    localIdx = localList.findIndex(s => s.id === targetId || (s.responses && s.responses.id === targetId));

    if (localIdx >= 0) {
      const item = localList[localIdx];
      submissionTarget = item.responses
        ? typeof item.responses === 'string'
          ? JSON.parse(item.responses)
          : item.responses
        : item;
      clientUsed = 'local';
    }
  }

  if (!submissionTarget) {
    return res.status(404).json({ error: `Submission '${targetId}' not found.` });
  }

  submissionTarget.manualGrades = {
    ...submissionTarget.manualGrades,
    ...manualGrades,
  };

  let totalScore = submissionTarget.autoGraded ? submissionTarget.autoGraded.score || 0 : 0;
  Object.values(submissionTarget.manualGrades).forEach(g => {
    if (g && g.status === 'correct') {
      totalScore += typeof g.score === 'number' ? g.score : 1;
    }
  });

  const totalQuestions = submissionTarget.questions ? submissionTarget.questions.length : 0;
  const percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

  submissionTarget.finalScore = {
    score: totalScore,
    total: totalQuestions,
    percentage,
  };

  submissionTarget.status = 'reviewed';
  submissionTarget.reviewedAt = new Date().toISOString();

  if (isConfigured() && clientUsed && clientUsed !== 'local') {
    const adminDb = getAdminClient() || supabase;
    try {
      const { error: updateErr } = await clientUsed
        .from('submissions')
        .update({
          total_score: totalScore,
          percentage,
          responses: submissionTarget,
        })
        .eq('id', targetId);

      if (updateErr && adminDb && adminDb !== clientUsed) {
        await adminDb
          .from('submissions')
          .update({
            total_score: totalScore,
            percentage,
            responses: submissionTarget,
          })
          .eq('id', targetId);
      }
    } catch (_) {}
  } else if (!isConfigured() && localIdx >= 0) {
    localList[localIdx] = {
      ...localList[localIdx],
      total_score: totalScore,
      percentage,
      responses: submissionTarget,
      ...submissionTarget,
    };
    writeSubmissionsLocal(localList);
  }

  return res.json({
    success: true,
    submission: submissionTarget,
  });
});

module.exports = router;
