import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../app';
import studentAuthService from '../services/studentAuthService';
import {
  getFilePath,
  writeLocalStudents,
  writeTeacherStudentsLocal,
  writeExamsLocal,
  writeSubmissionsLocal,
} from '../services/localStoreService';

describe('Production Hardening Regression Suite', () => {
  const originalEnv = { ...process.env };
  let isolatedDataDir = '';

  beforeAll(() => {
    isolatedDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlp-hardening-'));
  });

  afterAll(() => {
    if (isolatedDataDir && fs.existsSync(isolatedDataDir)) {
      fs.rmSync(isolatedDataDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.ALLOW_DEMO_AUTH;
    delete process.env.CLIENT_ORIGIN;
    delete process.env.CORS_ORIGINS;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_BRANCH_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.NODE_ENV = 'test';
    process.env.LOCAL_DATA_DIR = isolatedDataDir;
    writeLocalStudents([]);
    writeTeacherStudentsLocal([]);
    writeExamsLocal([]);
    writeSubmissionsLocal([]);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('1. Sets trust proxy = 1 and handles X-Forwarded-For without express-rate-limit ValidationError', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const app = createApp();
    expect(app.get('trust proxy')).toBe(1);

    const res = await request(app)
      .get('/api/health')
      .set('X-Forwarded-For', '203.0.113.42');

    expect(res.status).toBe(200);
    const logs = [...errorSpy.mock.calls, ...warnSpy.mock.calls].flat().join(' ');
    expect(logs).not.toMatch(/ERR_ERL_UNEXPECTED_X_FORWARDED_FOR|ValidationError/i);
  });

  it('2. Allows same-origin custom domain requests without CLIENT_ORIGIN, supports multi-origin CLIENT_ORIGIN, and blocks cross-site *.vercel.app with 403', async () => {
    process.env.CLIENT_ORIGIN = 'https://portal-a.example.org, https://portal-b.example.org';
    const app = createApp();

    // Same-origin custom domain without being listed in CLIENT_ORIGIN
    const sameOriginRes = await request(app)
      .get('/api/health')
      .set('Origin', 'https://custom-academy.in')
      .set('Host', 'custom-academy.in')
      .set('X-Forwarded-Proto', 'https');
    expect(sameOriginRes.status).toBe(200);
    expect(sameOriginRes.headers['access-control-allow-origin']).toBe('https://custom-academy.in');

    // Configured multi-origin entry
    const configuredRes = await request(app)
      .get('/api/health')
      .set('Origin', 'https://portal-b.example.org')
      .set('Host', 'api.example.org');
    expect(configuredRes.status).toBe(200);
    expect(configuredRes.headers['access-control-allow-origin']).toBe('https://portal-b.example.org');

    // Cross-origin untrusted *.vercel.app must be denied cleanly with 403 (not 500 or wildcard allow)
    const rogueVercelRes = await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil-attacker.vercel.app')
      .set('Host', 'my-real-app.vercel.app')
      .set('X-Forwarded-Proto', 'https');
    expect(rogueVercelRes.status).toBe(403);
    expect(rogueVercelRes.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('3. Enforces JWT_SECRET in production and rejects forged default-secret student JWTs', async () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    const app = createApp();

    const forgedToken = jwt.sign(
      { studentId: 'stu_victim', admissionNumber: 'DLP-26-00001', fullName: 'Victim', role: 'student' },
      'antigravity_dlp_secret_key_2026',
      { expiresIn: '1h' }
    );

    // Missing JWT_SECRET in prod must fail closed (503) rather than validating with default fallback secret
    const meNoSecretRes = await request(app)
      .get('/api/student/me')
      .set('Authorization', `Bearer ${forgedToken}`);
    expect(meNoSecretRes.status).toBe(503);

    const joinNoSecretRes = await request(app)
      .post('/api/student-auth/join-class')
      .set('Authorization', `Bearer ${forgedToken}`)
      .send({ classCode: 'CLASS-DEMO26' });
    expect(joinNoSecretRes.status).toBe(503);

    // Placeholder JWT_SECRET must also be treated as unconfigured
    process.env.JWT_SECRET = 'your_jwt_secret_key_here';
    const placeholderRes = await request(app)
      .get('/api/student/me')
      .set('Authorization', `Bearer ${forgedToken}`);
    expect(placeholderRes.status).toBe(503);

    // With real JWT_SECRET set, forged token from default secret must fail with 403
    process.env.JWT_SECRET = 'super_strong_production_secret_987654321';
    const forgedRes = await request(app)
      .get('/api/student/me')
      .set('Authorization', `Bearer ${forgedToken}`);
    expect(forgedRes.status).toBe(403);
  });

  it('4. Requires student authentication on POST /api/student-auth/join-class and ignores body.studentId', async () => {
    const app = createApp();

    // Unauthenticated call to alias must be 401
    const unauthRes = await request(app)
      .post('/api/student-auth/join-class')
      .send({ studentId: 'stu_target', classCode: 'CLASS-DEMO26' });
    expect(unauthRes.status).toBe(401);

    // Register student A & student B
    const stuA = await studentAuthService.studentSignup({
      admissionNumber: 'DLP-26-AAAA1',
      fullName: 'Student Alpha',
      dob: '2008-01-10',
    });
    const stuB = await studentAuthService.studentSignup({
      admissionNumber: 'DLP-26-BBBB2',
      fullName: 'Student Beta',
      dob: '2008-02-20',
    });

    // Student A attempts to enroll Student B by passing body.studentId
    const spoofJoinRes = await request(app)
      .post('/api/student-auth/join-class')
      .set('Authorization', `Bearer ${stuA.token}`)
      .send({ studentId: stuB.student.id, classCode: 'CLASS-DEMO26' });

    expect(spoofJoinRes.status).toBe(200);
    const demoRoster = await studentAuthService.getTeacherRoster('local-dev-user');
    expect(demoRoster.some((s) => s.id === stuA.student.id)).toBe(true);
    expect(demoRoster.some((s) => s.id === stuB.student.id)).toBe(false);
  });

  it('5. resolveTeacherFromClassCode rejects hardcoded demo/admin passcodes in prod and returns null on unrecognized codes', async () => {
    process.env.NODE_ENV = 'production';
    expect(await studentAuthService.resolveTeacherFromClassCode('admin')).toBeNull();
    expect(await studentAuthService.resolveTeacherFromClassCode('dlp_teacher_secret_passcode_2026')).toBeNull();
    expect(await studentAuthService.resolveTeacherFromClassCode('CLASS-DEMO26')).toBeNull();
    expect(await studentAuthService.resolveTeacherFromClassCode('CLASS-GEN026')).toBeNull();
    expect(await studentAuthService.resolveTeacherFromClassCode('CLASS-BOGUS9')).toBeNull();

    // Also in test mode, unknown CLASS- code must return null instead of echoing raw input
    process.env.NODE_ENV = 'test';
    expect(await studentAuthService.resolveTeacherFromClassCode('CLASS-UNKNOWN')).toBeNull();
  });

  it('6. Enforces strict multi-tenant isolation across roster, lookup, dossier, update, and delete', async () => {
    const stuUnassigned = await studentAuthService.studentSignup({
      admissionNumber: 'DLP-26-UNAS1',
      fullName: 'Unassigned Student',
      dob: '2008-03-15',
    });

    const stuTeacherA = await studentAuthService.teacherCreateStudent({
      teacherId: 'teacher_alpha',
      admissionNumber: 'DLP-26-TCHR1',
      fullName: 'Rahul Verma',
      dob: '2008-04-12',
    });

    const stuTeacherB = await studentAuthService.teacherCreateStudent({
      teacherId: 'teacher_beta',
      admissionNumber: 'DLP-26-TCHR2',
      fullName: 'Neha Singh',
      dob: '2008-05-14',
    });

    // getTeacherRoster must NOT include unassigned students or another teacher's students
    const rosterA = await studentAuthService.getTeacherRoster('teacher_alpha');
    expect(rosterA.map((s) => s.id)).toEqual([stuTeacherA.student.id]);
    expect(rosterA.some((s) => s.id === stuUnassigned.student.id)).toBe(false);
    expect(rosterA.some((s) => s.id === stuTeacherB.student.id)).toBe(false);

    // Fuzzy partial name lookup must NOT enumerate students across tenants
    await expect(
      studentAuthService.teacherAddExistingStudent({
        teacherId: 'teacher_beta',
        admissionNumber: 'Rahu',
        fullName: 'Rahu',
      })
    ).rejects.toThrow(/No student found/i);

    // Cross-tenant dossier, update, and delete by Teacher Beta against Teacher A's student must throw 403 Forbidden
    await expect(
      studentAuthService.getStudentDossier(stuTeacherA.student.id, 'teacher_beta')
    ).rejects.toThrow(/Forbidden/i);

    await expect(
      studentAuthService.updateStudentProfile(
        stuTeacherA.student.id,
        { fullName: 'Hacked Name' },
        'teacher_beta'
      )
    ).rejects.toThrow(/Forbidden/i);

    await expect(
      studentAuthService.deleteStudentProfile(stuTeacherA.student.id, 'teacher_beta')
    ).rejects.toThrow(/Forbidden/i);

    // Owner (Teacher Alpha) CAN inspect dossier, update, and remove their own student
    const ownDossier = await studentAuthService.getStudentDossier(stuTeacherA.student.id, 'teacher_alpha');
    expect(ownDossier.student.id).toBe(stuTeacherA.student.id);

    const updated = await studentAuthService.updateStudentProfile(
      stuTeacherA.student.id,
      { fullName: 'Rahul K. Verma' },
      'teacher_alpha'
    );
    expect(updated.full_name).toBe('Rahul K. Verma');

    const delRes = await studentAuthService.deleteStudentProfile(stuTeacherA.student.id, 'teacher_alpha');
    expect(delRes.deleted).toBe(true);
  });

  it('7. Enforces HTTP-level 403/404 status codes, uses local-dev-user scope, and trusts X-Forwarded-Host on /api/teacher/class-code', async () => {
    const app = createApp();

    const stuA = await studentAuthService.teacherCreateStudent({
      teacherId: 'local-dev-user',
      admissionNumber: 'DLP-26-LOC01',
      fullName: 'Local Teacher Student',
      dob: '2008-06-01',
    });
    const stuOther = await studentAuthService.teacherCreateStudent({
      teacherId: 'other_teacher',
      admissionNumber: 'DLP-26-OTH01',
      fullName: 'Other Teacher Student',
      dob: '2008-06-02',
    });

    // Dev teacher roster must see stuA (local-dev-user), NOT stuOther, ignoring ?teacherId override
    const rosterRes = await request(app)
      .get('/api/teacher/students?teacherId=other_teacher')
      .set('Authorization', 'Bearer dev-fallback-token');
    expect(rosterRes.status).toBe(200);
    expect(rosterRes.body.data.some((s) => s.id === stuA.student.id)).toBe(true);
    expect(rosterRes.body.data.some((s) => s.id === stuOther.student.id)).toBe(false);

    // Cross-tenant dossier / PATCH / DELETE via HTTP must return 403 (not 404 or 400 or 200)
    const crossDossier = await request(app)
      .get(`/api/teacher/students/${stuOther.student.id}/dossier`)
      .set('Authorization', 'Bearer dev-fallback-token');
    expect(crossDossier.status).toBe(403);

    const crossPatch = await request(app)
      .patch(`/api/teacher/students/${stuOther.student.id}`)
      .set('Authorization', 'Bearer dev-fallback-token')
      .send({ fullName: 'Tampered' });
    expect(crossPatch.status).toBe(403);

    const crossDelete = await request(app)
      .delete(`/api/teacher/students/${stuOther.student.id}`)
      .set('Authorization', 'Bearer dev-fallback-token');
    expect(crossDelete.status).toBe(403);

    // Missing student returns 404
    const missingDossier = await request(app)
      .get('/api/teacher/students/stu_missing_999/dossier')
      .set('Authorization', 'Bearer dev-fallback-token');
    expect(missingDossier.status).toBe(404);

    // Forwarded HTTPS host reflected in inviteLink
    const classCodeRes = await request(app)
      .get('/api/teacher/class-code')
      .set('Authorization', 'Bearer dev-fallback-token')
      .set('X-Forwarded-Host', 'portal.myacademy.edu')
      .set('X-Forwarded-Proto', 'https');
    expect(classCodeRes.status).toBe(200);
    expect(classCodeRes.body.classCode).toBe('CLASS-DEMO26');
    expect(classCodeRes.body.inviteLink).toBe(
      'https://portal.myacademy.edu/?mode=student&tab=signup&classCode=CLASS-DEMO26'
    );
  });

  it('8. Rejects hardcoded rolling passcode secret in production when env secrets are missing and uses JWT_SECRET if set', async () => {
    delete process.env.APP_PASSWORD;
    delete process.env.TEACHER_ACCESS_CODE;
    delete process.env.JWT_SECRET;
    process.env.ALLOW_DEMO_AUTH = 'true';
    const app = createApp();

    // First verify what the hardcoded fallback code would look like in demo mode
    const examsRouter = require('../routes/exams');
    // Switch to strict production without any secret: must NOT accept the hardcoded default code
    delete process.env.ALLOW_DEMO_AUTH;
    process.env.NODE_ENV = 'production';

    const crypto = require('crypto');
    const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
    const h = crypto
      .createHmac('sha256', 'rolling-passcode-secret-key')
      .update(`exam_123_${bucket}`)
      .digest('hex');
    const hardcodedFallbackCode = ((parseInt(h.substring(0, 8), 16) % 900000) + 100000).toString();

    // Even before DB check, student-access in production without secret must NEVER match hardcodedFallbackCode
    // Wait: without SUPABASE configured, student-access in prod hits local fallback or fails 503/403
    // Verify directly via get5MinRollingCode helper if exported, or via local exam route behavior
    expect(typeof examsRouter.get5MinRollingCode).toBe('function');
    expect(examsRouter.get5MinRollingCode('exam_123', 0)).toBeNull();
    expect(hardcodedFallbackCode).toMatch(/^\d{6}$/);

    // With JWT_SECRET configured in production, rolling code is generated from JWT_SECRET (not hardcoded default)
    process.env.JWT_SECRET = 'prod_jwt_secret_for_rolling_code_999';
    const prodCode = examsRouter.get5MinRollingCode('exam_123', 0);
    expect(prodCode).toMatch(/^\d{6}$/);
    expect(prodCode).not.toBe(hardcodedFallbackCode);
  });

  it('9. Rejects unauthenticated POST /api/submissions spoofing body.studentId in production (and ignores forged token)', async () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    const app = createApp();

    // In production without Supabase configured, unauthenticated non-demo submission fails closed with 503
    const unconfRes = await request(app)
      .post('/api/submissions')
      .send({
        examId: 'exam_real_1',
        studentId: 'stu_victim',
        studentName: 'Spoofer',
        studentAnswers: { q1: 0 },
      });
    expect(unconfRes.status).toBe(503);

    // Even if ALLOW_DEMO_AUTH is false in prod with missing JWT_SECRET, extractVerifiedStudentFromHeader ignores forged default JWT
    const submissionsRouter = require('../routes/submissions');
    const forgedToken = jwt.sign(
      { studentId: 'stu_victim', role: 'student' },
      'antigravity_dlp_secret_key_2026'
    );
    expect(
      submissionsRouter.extractVerifiedStudentFromHeader({
        headers: { authorization: `Bearer ${forgedToken}` },
      })
    ).toBeNull();

    // Even if DB is configured in prod, resolveSubmissionStudentId must ignore unauthenticated body.studentId
    expect(
      submissionsRouter.resolveSubmissionStudentId({
        verifiedJwtStudent: null,
        isDevDemo: false,
        requestedStudentId: 'stu_victim',
      })
    ).toBeNull();

    // Valid signed student JWT resolves strictly to decoded token's studentId
    process.env.JWT_SECRET = 'prod_jwt_secret_submissions_test_123';
    const validToken = jwt.sign(
      { studentId: 'stu_verified_1', fullName: 'Real Student', role: 'student' },
      process.env.JWT_SECRET
    );
    const verified = submissionsRouter.extractVerifiedStudentFromHeader({
      headers: { authorization: `Bearer ${validToken}` },
    });
    expect(
      submissionsRouter.resolveSubmissionStudentId({
        verifiedJwtStudent: verified,
        isDevDemo: false,
        requestedStudentId: 'stu_someone_else',
      })
    ).toBe('stu_verified_1');
  });

  it('10. Uses LOCAL_DATA_DIR in test mode for worker isolation and still enforces [Durable Storage Required] in production', () => {
    expect(getFilePath('exams.json').startsWith(isolatedDataDir)).toBe(true);

    process.env.NODE_ENV = 'production';
    process.env.LOCAL_DATA_DIR = isolatedDataDir;
    expect(() => getFilePath('exams.json')).toThrow(/\[Durable Storage Required\]/);
  });
});
