const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { supabase, isConfigured, createUserClient } = require('../services/supabaseClient');
const { verifyTeacherAuth } = require('../services/authService');
const {
  readSubmissionsLocal,
  writeSubmissionsLocal
} = require('../services/localStoreService');

/**
 * PUBLIC Student Endpoint: POST /api/submissions
 * Persists directly to Supabase when configured; uses local fallback only in test/unconfigured mode.
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
  const isDevDemo = Boolean(body.isDevDemo || body.is_dev_demo);
  const attemptNumber = typeof body.attemptNumber === 'number' ? body.attemptNumber : 1;

  let targetExamId = null;

  if (isConfigured()) {
    if (rawExamId && rawExamId !== 'exam_default') {
      try {
        const { data: existing } = await supabase.from('exams').select('id').eq('id', rawExamId).single();
        if (existing && existing.id) {
          targetExamId = existing.id;
        }
      } catch (_) {}
    }

    if (!targetExamId && rollingCodeUsed) {
      try {
        const { data: activeExams } = await supabase.from('exams').select('id').neq('status', 'closed');
        if (Array.isArray(activeExams) && activeExams.length > 0) {
          targetExamId = activeExams[0].id;
        }
      } catch (_) {}
    }

    const submissionObj = {
      id: serverGeneratedId,
      examId: targetExamId || rawExamId || 'exam_default',
      studentId,
      isDevDemo,
      attemptNumber,
      testTitle,
      studentName: isDevDemo ? `[Dev Demo] ${studentName}` : studentName,
      rollingCodeUsed,
      submittedAt,
      autoGraded,
      pendingCount,
      status: pendingCount > 0 ? 'pending_review' : 'reviewed',
      questions,
      studentAnswers,
      cheatingFlagged: Boolean(body.cheatingFlagged),
      cheatingReason: body.cheatingReason || '',
      manualGrades: {},
      finalScore: {
        score: autoGraded.score,
        total: questions.length,
        percentage: questions.length > 0 ? Math.round((autoGraded.score / questions.length) * 100) : 0
      }
    };

    try {
      const insertPayload = {
        id: serverGeneratedId,
        student_id: studentId,
        student_name: submissionObj.studentName,
        rolling_code_used: rollingCodeUsed,
        total_score: autoGraded.score || 0,
        max_possible: questions.length || 0,
        percentage: autoGraded.percentage || 0,
        time_taken_seconds: body.timeTakenSeconds || 0,
        is_dev_demo: isDevDemo,
        attempt_number: attemptNumber,
        responses: submissionObj,
        submitted_at: submittedAt
      };
      if (targetExamId) {
        insertPayload.exam_id = targetExamId;
      }

      const { error: insertError } = await supabase.from('submissions').insert(insertPayload);
      if (insertError) {
        return res.status(500).json({ error: `Failed to save submission to Supabase: ${insertError.message}` });
      }
    } catch (dbErr) {
      return res.status(500).json({ error: `Database error saving submission: ${dbErr.message}` });
    }

    return res.json({
      success: true,
      submissionId: serverGeneratedId,
      status: submissionObj.status
    });
  } else {
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
      autoGraded,
      pendingCount,
      status: pendingCount > 0 ? 'pending_review' : 'reviewed',
      questions,
      studentAnswers,
      cheatingFlagged: Boolean(body.cheatingFlagged),
      cheatingReason: body.cheatingReason || '',
      manualGrades: {},
      finalScore: {
        score: autoGraded.score,
        total: questions.length,
        percentage: questions.length > 0 ? Math.round((autoGraded.score / questions.length) * 100) : 0
      }
    };

    const list = readSubmissionsLocal();
    list.unshift(submissionObj);
    writeSubmissionsLocal(list);

    return res.json({
      success: true,
      submissionId: serverGeneratedId,
      status: submissionObj.status
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
    try {
      const userDb = createUserClient(req.accessToken);
      const { data: userData, error: userError } = await userDb
        .from('submissions')
        .select('id, student_name, percentage, total_score, responses, submitted_at')
        .order('submitted_at', { ascending: false });

      if (!userError && Array.isArray(userData)) {
        allSubmissions = userData;
      } else {
        const { data: adminData } = await supabase
          .from('submissions')
          .select('id, student_name, percentage, total_score, responses, submitted_at')
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
        studentName: item.student_name || resp.studentName,
        percentage: item.percentage ?? resp.finalScore?.percentage,
        totalScore: item.total_score ?? resp.finalScore?.score,
        submittedAt: item.submitted_at || resp.submittedAt
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
    try {
      const userDb = createUserClient(req.accessToken);
      const { data: userData, error: userErr } = await userDb
        .from('submissions')
        .select('responses')
        .eq('id', targetId)
        .maybeSingle();

      if (!userErr && userData && userData.responses) {
        submissionTarget = typeof userData.responses === 'string' ? JSON.parse(userData.responses) : userData.responses;
        clientUsed = userDb;
      } else {
        const { data: adminData, error: adminErr } = await supabase
          .from('submissions')
          .select('responses')
          .eq('id', targetId)
          .maybeSingle();

        if (!adminErr && adminData && adminData.responses) {
          submissionTarget = typeof adminData.responses === 'string' ? JSON.parse(adminData.responses) : adminData.responses;
          clientUsed = supabase;
        }
      }
    } catch (_) {}
  } else {
    localList = readSubmissionsLocal();
    localIdx = localList.findIndex(s => s.id === targetId || (s.responses && s.responses.id === targetId));

    if (localIdx >= 0) {
      const item = localList[localIdx];
      submissionTarget = item.responses ? (typeof item.responses === 'string' ? JSON.parse(item.responses) : item.responses) : item;
      clientUsed = 'local';
    }
  }

  if (!submissionTarget) {
    return res.status(404).json({ error: `Submission '${targetId}' not found.` });
  }

  submissionTarget.manualGrades = {
    ...submissionTarget.manualGrades,
    ...manualGrades
  };

  let totalScore = submissionTarget.autoGraded ? (submissionTarget.autoGraded.score || 0) : 0;
  Object.values(submissionTarget.manualGrades).forEach(g => {
    if (g && g.status === 'correct') {
      totalScore += (typeof g.score === 'number' ? g.score : 1);
    }
  });

  const totalQuestions = submissionTarget.questions ? submissionTarget.questions.length : 0;
  const percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

  submissionTarget.finalScore = {
    score: totalScore,
    total: totalQuestions,
    percentage
  };

  submissionTarget.status = 'reviewed';
  submissionTarget.reviewedAt = new Date().toISOString();

  if (isConfigured() && clientUsed && clientUsed !== 'local') {
    try {
      const { error: updateErr } = await clientUsed
        .from('submissions')
        .update({
          total_score: totalScore,
          percentage,
          responses: submissionTarget
        })
        .eq('id', targetId);

      if (updateErr) {
        await supabase
          .from('submissions')
          .update({
            total_score: totalScore,
            percentage,
            responses: submissionTarget
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
      ...submissionTarget
    };
    writeSubmissionsLocal(localList);
  }

  return res.json({
    success: true,
    submission: submissionTarget
  });
});

module.exports = router;
