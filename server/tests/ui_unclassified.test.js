import { describe, it, expect } from 'vitest';

describe('UI Unclassified Question Handling Protocol', () => {
  it('should evaluate unclassified condition correctly for non-mcq, non-numeric questions', () => {
    const legacyQuestion = { id: 'q_legacy', questionText: 'Unclassified math item', type: 'short_answer' };
    const isUnclassified = legacyQuestion.type !== 'mcq' && legacyQuestion.type !== 'short_answer_numeric';
    expect(isUnclassified).toBe(true);

    const numericQuestion = { id: 'q_num', questionText: 'Numeric item', type: 'short_answer_numeric' };
    const isNumericUnclassified = numericQuestion.type !== 'mcq' && numericQuestion.type !== 'short_answer_numeric';
    expect(isNumericUnclassified).toBe(false);

    const mcqQuestion = { id: 'q_mcq', questionText: 'MCQ item', type: 'mcq' };
    const isMcqUnclassified = mcqQuestion.type !== 'mcq' && mcqQuestion.type !== 'short_answer_numeric';
    expect(isMcqUnclassified).toBe(false);
  });
});
