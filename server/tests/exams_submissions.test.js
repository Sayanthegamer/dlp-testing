import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../index';
import { writeExamsLocal, writeSubmissionsLocal } from '../services/localStoreService';

const submissionsPath = path.resolve(__dirname, '../data/submissions.json');
const examsPath = path.resolve(__dirname, '../data/exams.json');

describe('Published Exam Snapshot, Answer-Key Stripping & Server-Side Grading Pipeline', () => {
  let originalSubmissionsBuf = null;
  let examsExisted = false;
  let originalExamsBuf = null;

  beforeAll(() => {
    if (fs.existsSync(submissionsPath)) {
      originalSubmissionsBuf = fs.readFileSync(submissionsPath);
    }
    if (fs.existsSync(examsPath)) {
      examsExisted = true;
      originalExamsBuf = fs.readFileSync(examsPath);
    }
  });

  afterAll(() => {
    if (originalSubmissionsBuf !== null) {
      fs.writeFileSync(submissionsPath, originalSubmissionsBuf);
    }
    if (examsExisted && originalExamsBuf !== null) {
      fs.writeFileSync(examsPath, originalExamsBuf);
    } else if (!examsExisted && fs.existsSync(examsPath)) {
      fs.unlinkSync(examsPath);
    }
  });

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    writeExamsLocal([]);
    writeSubmissionsLocal([]);
  });

  it('should publish an exam, strip answer keys on student fetch & student-access, grade server-side ignoring spoofed client scores, and support teacher manual grading', async () => {
    // 1. Publish exam as teacher
    const publishRes = await request(app)
      .post('/api/exams/publish')
      .set('Authorization', 'Bearer dev-fallback-token')
      .send({
        testTitle: 'Stage 1 Verification Paper',
        questions: [
          {
            id: 'q1',
            questionText: 'What is 2 + 2?',
            type: 'mcq',
            options: ['3', '4', '5', '6'],
            correctAnswer: 1,
          },
          {
            id: 'q2',
            questionText: 'Acceleration due to gravity (m/s^2)',
            type: 'short_answer_numeric',
            options: [],
            correctAnswer: 9.8,
            acceptedRange: [9.75, 9.85],
          },
        ],
      });

    expect(publishRes.status).toBe(200);
    expect(publishRes.body.success).toBe(true);
    const { examId } = publishRes.body;

    // 2. Start rolling session
    const sessionRes = await request(app)
      .post('/api/exams/session/start')
      .set('Authorization', 'Bearer dev-fallback-token')
      .send({ examId, durationMinutes: 60 });

    expect(sessionRes.status).toBe(200);
    const { rollingCode } = sessionRes.body;

    // 3a. Student enters via POST /api/exams/student-access -> verify answer keys are stripped!
    const accessRes = await request(app)
      .post('/api/exams/student-access')
      .send({
        studentName: 'Rohan Gupta',
        rollingCode,
        examId,
      });

    expect(accessRes.status).toBe(200);
    const accessQuestions = accessRes.body.exam.questions;
    expect(accessQuestions.length).toBe(2);
    expect(accessQuestions[0].correctAnswer).toBeUndefined();
    expect(accessQuestions[1].correctAnswer).toBeUndefined();
    expect(accessQuestions[1].acceptedRange).toBeUndefined();

    // 3b. Student fetches exam paper via GET /api/exams/:id -> verify answer keys are stripped!
    const studentFetchRes = await request(app)
      .get(`/api/exams/${examId}?code=${rollingCode}`);

    expect(studentFetchRes.status).toBe(200);
    const studentQuestions = studentFetchRes.body.exam.questions;
    expect(studentQuestions.length).toBe(2);
    expect(studentQuestions[0].correctAnswer).toBeUndefined();
    expect(studentQuestions[1].correctAnswer).toBeUndefined();
    expect(studentQuestions[1].acceptedRange).toBeUndefined();

    // 4. Student submits attempt with a spoofed 100% autoGraded score, but only 1 of 2 answers is actually right
    const submitRes = await request(app)
      .post('/api/submissions')
      .send({
        examId,
        rollingCodeUsed: rollingCode,
        studentName: 'Rohan Gupta',
        studentId: 'stu_test_1',
        // Spoofed client payload claiming 2/2 (100%):
        autoGraded: { score: 999, total: 2, percentage: 100 },
        studentAnswers: {
          q1: 1, // Correct
          q2: '15.0', // Incorrect (outside [9.75, 9.85])
        },
      });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.success).toBe(true);
    // Server must compute 1 / 2 (50%), ignoring spoofed client score 999
    expect(submitRes.body.submission.autoGraded.score).toBe(1);
    expect(submitRes.body.submission.autoGraded.total).toBe(2);
    expect(submitRes.body.submission.autoGraded.percentage).toBe(50);

    // 5. Teacher applies manual grade override on q2
    const submissionId = submitRes.body.submissionId;
    const gradeRes = await request(app)
      .post(`/api/submissions/${submissionId}/grade`)
      .set('Authorization', 'Bearer dev-fallback-token')
      .send({
        manualGrades: {
          q2: { status: 'correct', score: 1 },
        },
      });

    expect(gradeRes.status).toBe(200);
    expect(gradeRes.body.submission.finalScore.score).toBe(2);
    expect(gradeRes.body.submission.finalScore.percentage).toBe(100);
  });

  it('should reject submissions targeting a non-existent or closed exam instead of reassigning to another exam', async () => {
    // Publish an active exam so one exists in storage
    const publishRes = await request(app)
      .post('/api/exams/publish')
      .set('Authorization', 'Bearer dev-fallback-token')
      .send({
        testTitle: 'Active Exam A',
        questions: [
          {
            id: 'q1',
            questionText: 'Question 1',
            type: 'mcq',
            options: ['A', 'B'],
            correctAnswer: 0,
          },
        ],
      });
    const activeExamId = publishRes.body.examId;

    // Attempt to submit against a bogus examId -> must 404, NOT attach to Active Exam A
    const bogusRes = await request(app)
      .post('/api/submissions')
      .send({
        examId: 'exam_non_existent_999',
        studentName: 'Test Candidate',
        studentAnswers: { q1: 0 },
      });
    expect(bogusRes.status).toBe(404);

    // Close Active Exam A and attempt to submit -> must 403
    await request(app)
      .patch(`/api/exams/${activeExamId}/status`)
      .set('Authorization', 'Bearer dev-fallback-token')
      .send({ status: 'closed' });

    const closedRes = await request(app)
      .post('/api/submissions')
      .send({
        examId: activeExamId,
        studentName: 'Test Candidate',
        studentAnswers: { q1: 0 },
      });
    expect(closedRes.status).toBe(403);
  });
});
