/**
 * Single Source of Truth Grading Engine for Student Test-Taking & Teacher Dashboard.
 */

/**
 * Evaluates a single question against student input.
 */
export function evaluateQuestion(question, studentAnswer) {
  if (!question) return { status: 'pending_review', isAutoGraded: false, isCorrect: false };

  if (question.type === 'mcq') {
    if (question.correctAnswer === null || question.correctAnswer === undefined || typeof question.correctAnswer !== 'number') {
      return { status: 'pending_review', isAutoGraded: false, isCorrect: false };
    }
    const isCorrect = studentAnswer === question.correctAnswer;
    return { status: isCorrect ? 'correct' : 'incorrect', isAutoGraded: true, isCorrect };
  }

  if (question.type === 'short_answer_numeric') {
    const range = question.acceptedRange;
    const isValidRange = Array.isArray(range) && 
      range.length === 2 && 
      typeof range[0] === 'number' && Number.isFinite(range[0]) &&
      typeof range[1] === 'number' && Number.isFinite(range[1]) &&
      range[0] <= range[1];

    if (!isValidRange || question.correctAnswer === null || question.correctAnswer === undefined) {
      return { status: 'pending_review', isAutoGraded: false, isCorrect: false };
    }

    const parsedInput = parseFloat(studentAnswer);
    const isCorrect = !isNaN(parsedInput) && parsedInput >= range[0] && parsedInput <= range[1];
    return { status: isCorrect ? 'correct' : 'incorrect', isAutoGraded: true, isCorrect };
  }

  // short_answer_text or unclassified legacy short_answer
  return { status: 'pending_review', isAutoGraded: false, isCorrect: false };
}

/**
 * Evaluates an entire student attempt (used for initial student score).
 */
export function gradeAttempt(questions = [], studentAnswers = {}) {
  let score = 0;
  let total = 0;
  const pendingReview = [];
  const perQuestion = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qId = q.id || `q_${i}`;
    const studentAns = studentAnswers[qId];

    const evalRes = evaluateQuestion(q, studentAns);
    if (evalRes.isAutoGraded) {
      total += 1;
      if (evalRes.isCorrect) score += 1;
    } else {
      pendingReview.push(qId);
    }

    perQuestion.push({
      questionId: qId,
      questionIndex: i,
      type: q.type,
      studentAnswer: studentAns,
      correctAnswer: q.correctAnswer,
      acceptedRange: q.acceptedRange,
      status: evalRes.status,
      isAutoGraded: evalRes.isAutoGraded,
      isCorrect: evalRes.isCorrect
    });
  }

  return {
    autoGraded: {
      score,
      total,
      percentage: total > 0 ? Math.round((score / total) * 100) : null
    },
    pendingReview,
    perQuestion
  };
}

/**
 * Evaluates a full submission including teacher manual overrides (used in Teacher Submissions Dashboard).
 * Note: Unlike gradeAttempt (where total = auto-gradable questions only), evaluateSubmission uses total = all questions
 * in the paper so every question (including text items) counts toward the final 100% scorecard grade when reviewed.
 */
export function evaluateSubmission(questions = [], studentAnswers = {}, manualGrades = {}) {
  let score = 0;
  let pendingCount = 0;
  const total = questions.length;
  const perQuestion = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qId = q.id || `q_${i}`;
    const studentAns = studentAnswers[qId];
    const manualInfo = manualGrades[qId];

    const autoEval = evaluateQuestion(q, studentAns);
    let status = autoEval.status;

    // Teacher manual override takes precedence
    if (manualInfo && manualInfo.status) {
      status = manualInfo.status;
    }

    if (status === 'pending_review') {
      pendingCount += 1;
    }

    const isCorrect = status === 'correct';
    if (isCorrect) score += 1;

    perQuestion.push({
      questionId: qId,
      questionIndex: i,
      type: q.type,
      studentAnswer: studentAns,
      autoStatus: autoEval.status,
      effectiveStatus: status,
      isCorrect
    });
  }

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return {
    score,
    total,
    pendingCount,
    percentage,
    perQuestion
  };
}
