/**
 * Pure client-side grading engine for Student Test-Taking Pipeline (Phase 2).
 * 
 * Rules:
 * - MCQ: Exact option index match against question.correctAnswer.
 * - short_answer_numeric: Float parsing & inclusive range check against question.acceptedRange [min, max].
 * - short_answer_text & legacy bare short_answer: Routed to pendingReview, excluded from autoGraded.
 * - Missing/unset correctAnswer or malformed range: Routed to pendingReview.
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

    let status = 'pending_review'; // 'correct' | 'incorrect' | 'pending_review'
    let isAutoGraded = false;
    let isCorrect = false;

    if (q.type === 'mcq') {
      if (q.correctAnswer === null || q.correctAnswer === undefined || typeof q.correctAnswer !== 'number') {
        status = 'pending_review';
        pendingReview.push(qId);
      } else {
        isAutoGraded = true;
        total += 1;
        if (studentAns === q.correctAnswer) {
          isCorrect = true;
          score += 1;
          status = 'correct';
        } else {
          status = 'incorrect';
        }
      }
    } else if (q.type === 'short_answer_numeric') {
      const range = q.acceptedRange;
      const isValidRange = Array.isArray(range) && 
        range.length === 2 && 
        typeof range[0] === 'number' && Number.isFinite(range[0]) &&
        typeof range[1] === 'number' && Number.isFinite(range[1]) &&
        range[0] <= range[1];

      if (!isValidRange || q.correctAnswer === null || q.correctAnswer === undefined) {
        status = 'pending_review';
        pendingReview.push(qId);
      } else {
        isAutoGraded = true;
        total += 1;
        const parsedInput = parseFloat(studentAns);

        if (!isNaN(parsedInput) && parsedInput >= range[0] && parsedInput <= range[1]) {
          isCorrect = true;
          score += 1;
          status = 'correct';
        } else {
          status = 'incorrect';
        }
      }
    } else {
      // short_answer_text or unclassified legacy short_answer
      status = 'pending_review';
      pendingReview.push(qId);
    }

    perQuestion.push({
      questionId: qId,
      questionIndex: i,
      type: q.type,
      studentAnswer: studentAns,
      correctAnswer: q.correctAnswer,
      acceptedRange: q.acceptedRange,
      status,
      isAutoGraded,
      isCorrect
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
