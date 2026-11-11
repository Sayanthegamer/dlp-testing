/**
 * Server-Side Grading Engine & Answer Key Sanitizer
 * Computes authoritative scores from stored exam snapshots and strips answer keys from student-facing payloads.
 */

function evaluateQuestion(question, studentAnswer) {
  if (!question) return { status: 'pending_review', isAutoGraded: false, isCorrect: false };

  const correctAnswer =
    question.correctAnswer !== undefined ? question.correctAnswer : question.correct_answer;
  const acceptedRange =
    question.acceptedRange !== undefined ? question.acceptedRange : question.accepted_range;

  if (question.type === 'mcq' || question.type === 'match_following') {
    if (correctAnswer === null || correctAnswer === undefined || typeof correctAnswer !== 'number') {
      return { status: 'pending_review', isAutoGraded: false, isCorrect: false };
    }
    const isCorrect = Number(studentAnswer) === correctAnswer && studentAnswer !== '' && studentAnswer !== null && studentAnswer !== undefined;
    return { status: isCorrect ? 'correct' : 'incorrect', isAutoGraded: true, isCorrect };
  }

  if (
    question.type === 'short_answer_numeric' ||
    question.type === 'short_answer_text' ||
    question.type === 'short_answer'
  ) {
    let range = acceptedRange;

    if (
      (!Array.isArray(range) || range.length !== 2) &&
      typeof correctAnswer === 'number' &&
      Number.isFinite(correctAnswer)
    ) {
      range = [correctAnswer, correctAnswer];
    }

    const isValidRange =
      Array.isArray(range) &&
      range.length === 2 &&
      typeof range[0] === 'number' &&
      Number.isFinite(range[0]) &&
      typeof range[1] === 'number' &&
      Number.isFinite(range[1]) &&
      range[0] <= range[1];

    if (!isValidRange) {
      return { status: 'pending_review', isAutoGraded: false, isCorrect: false };
    }

    const parsedInput = parseFloat(studentAnswer);
    const isCorrect = !Number.isNaN(parsedInput) && parsedInput >= range[0] && parsedInput <= range[1];
    return { status: isCorrect ? 'correct' : 'incorrect', isAutoGraded: true, isCorrect };
  }

  return { status: 'pending_review', isAutoGraded: false, isCorrect: false };
}

function gradeAttempt(questions = [], studentAnswers = {}) {
  let score = 0;
  let total = 0;
  const pendingReview = [];
  const perQuestion = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qId = q.id || `q_${i}`;
    const studentAns = studentAnswers ? studentAnswers[qId] : undefined;

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
      correctAnswer: q.correctAnswer ?? q.correct_answer ?? null,
      acceptedRange: q.acceptedRange ?? q.accepted_range ?? null,
      status: evalRes.status,
      isAutoGraded: evalRes.isAutoGraded,
      isCorrect: evalRes.isCorrect,
    });
  }

  return {
    autoGraded: {
      score,
      total,
      percentage: total > 0 ? Math.round((score / total) * 100) : 0,
    },
    pendingReview,
    perQuestion,
  };
}

/**
 * Strips answer keys from an exam snapshot before sending it to a student taking an active test.
 */
function sanitizeExamSnapshotForStudent(examSnapshot) {
  if (!examSnapshot || typeof examSnapshot !== 'object') return examSnapshot;
  const cloned = { ...examSnapshot };
  if (Array.isArray(cloned.questions)) {
    cloned.questions = cloned.questions.map((q) => {
      if (!q || typeof q !== 'object') return q;
      const {
        correctAnswer,
        correct_answer,
        acceptedRange,
        accepted_range,
        ...safeQuestion
      } = q;
      return safeQuestion;
    });
  }
  return cloned;
}

module.exports = {
  evaluateQuestion,
  gradeAttempt,
  sanitizeExamSnapshotForStudent,
};
