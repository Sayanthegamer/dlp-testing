const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { supabase, isConfigured, createUserClient } = require('../services/supabaseClient');
const { verifyTeacherAuth } = require('../services/authService');

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
      } catch (e) {}
    }

    if (!targetExamId && rollingCodeUsed) {
      try {
        const { data: activeExams } = await supabase.from('exams').select('id').neq('status', 'closed');
        if (Array.isArray(activeExams) && activeExams.length > 0) {
          targetExamId = activeExams[0].id;
        }
      } catch (e) {}
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

    let savedToSupabase = false;
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

      if (!insertError) {
        savedToSupabase = true;
        console.log(`[Supabase Submissions] Successfully saved submission ${serverGeneratedId}`);
      } else {
        console.warn('[Supabase Submission Insert Error, writing local fallback]:', insertError.message);
      }
    } catch (dbErr) {
      console.error('[Supabase Submission Insert Exception]:', dbErr.message);
    }

    if (!savedToSupabase) {
      const list = readSubmissionsLocal();
      list.unshift(submissionObj);
      writeSubmissionsLocal(list);
    }

    return res.json({
      success: true,
      submissionId: serverGeneratedId,
      status: submissionObj.status
    });
  } else {
    // Unconfigured local dev mode fallback
    const submissionObj = {
      id: serverGeneratedId,
      examId: rawExamId || 'exam_default',
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

      if (!userError && Array.isArray(userData) && userData.length > 0) {
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
    } catch (e) {
      console.error('[Supabase Submissions Fetch Error]:', e.message);
    }
  }

  // Merge local file submissions as fallback
  const localList = readSubmissionsLocal();
  const existingIds = new Set(allSubmissions.map(s => s.id));
  localList.forEach(item => {
    if (!existingIds.has(item.id)) {
      allSubmissions.push(item);
    }
  });

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

  if (isConfigured()) {
    const userDb = createUserClient(req.accessToken);
    try {
      const { data: subData, error: subErr } = await userDb
        .from('submissions')
        .select('responses')
        .eq('id', targetId)
        .single();

      if (subErr || !subData || !subData.responses) {
        return res.status(404).json({ error: 'Submission not found in database.' });
      }

      const target = subData.responses;
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

      const { error: updateErr } = await userDb
        .from('submissions')
        .update({
          total_score: totalScore,
          percentage,
          responses: target
        })
        .eq('id', targetId);

      if (updateErr) {
        console.error('[Supabase Grade Update Error]:', updateErr.message);
        return res.status(500).json({ error: 'Failed to update grade in database.' });
      }

      return res.json({
        success: true,
        submission: target
      });
    } catch (e) {
      console.error('[Supabase Grade Update Exception]:', e.message);
      return res.status(500).json({ error: 'Database error updating grade.' });
    }
  } else {
    // Unconfigured local dev mode fallback
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

    list[subIndex] = target;
    writeSubmissionsLocal(list);

    return res.json({
      success: true,
      submission: target
    });
  }
});

module.exports = router;
