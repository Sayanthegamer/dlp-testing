import { describe, it, expect } from 'vitest';
import {
  studentLogin,
  studentSignup,
  getStudentSubmissions,
  teacherCreateStudent,
  getTeacherRoster,
  formatDob,
  computeTeacherClassCode,
  resolveTeacherFromClassCode,
  studentJoinClass,
  teacherAddExistingStudent,
  autoEnrollStudentWithExamTeacher
} from '../services/studentAuthService.js';

describe('Student Authentication & Multi-Tenant Roster Service Integration', () => {
  it('should correctly format DOB strings into standard YYYY-MM-DD', () => {
    expect(formatDob('2008-05-15')).toBe('2008-05-15');
    expect(formatDob('2008/05/15')).toBe('2008-05-15');
  });

  it('should allow frictionless student self-registration WITHOUT requiring a teacher code', async () => {
    const testAdm = `TEST_SELF_${Date.now()}`;
    const result = await studentSignup({
      admissionNumber: testAdm,
      fullName: 'Ananya Roy',
      dob: '2008-07-22'
      // No teacherId or classCode provided!
    });

    expect(result).toBeDefined();
    expect(result.token).toBeDefined();
    expect(result.student.admission_number).toBe(testAdm);
    expect(result.student.full_name).toBe('Ananya Roy');
    expect(result.student.dob).toBe('2008-07-22');
  });

  it('should generate permanent CLASS-XXXXXX codes deterministically', () => {
    const code1 = computeTeacherClassCode('local-dev-user');
    expect(code1).toBe('CLASS-DEMO26');

    const code2 = computeTeacherClassCode('teacher_general');
    expect(code2).toBe('CLASS-GEN026');

    const code3 = computeTeacherClassCode('custom-teacher-id-123');
    expect(code3.startsWith('CLASS-')).toBe(true);
    expect(code3.length).toBe(12); // CLASS- + 6 characters

    // Deterministic: same input gives exact same code
    expect(computeTeacherClassCode('custom-teacher-id-123')).toBe(code3);
  });

  it('should allow student registration with optional CLASS-XXXXXX code', async () => {
    const testAdm = `TEST_CLASS_${Date.now()}`;
    const result = await studentSignup({
      admissionNumber: testAdm,
      fullName: 'Vikram Seth',
      dob: '2008-03-12',
      classCode: 'CLASS-DEMO26'
    });

    expect(result).toBeDefined();
    expect(result.student.admission_number).toBe(testAdm);

    // Verify student is now enrolled in teacher roster
    const roster = await getTeacherRoster('local-dev-user');
    const found = roster.find(s => s.admission_number === testAdm);
    expect(found).toBeDefined();
  });

  it('should allow student to join a classroom anytime via studentJoinClass', async () => {
    const testAdm = `TEST_JOIN_${Date.now()}`;
    const regRes = await studentSignup({
      admissionNumber: testAdm,
      fullName: 'Kavita Das',
      dob: '2008-11-05'
    });

    const joinRes = await studentJoinClass({
      studentId: regRes.student.id,
      classCode: 'CLASS-DEMO26'
    });

    expect(joinRes.success).toBe(true);

    const roster = await getTeacherRoster('local-dev-user');
    const found = roster.find(s => s.admission_number === testAdm);
    expect(found).toBeDefined();
  });

  it('should allow teacher to add student by Roll Number without 5-minute code', async () => {
    const testAdm = `TEST_LOOKUP_${Date.now()}`;
    await studentSignup({
      admissionNumber: testAdm,
      fullName: 'Deepak Chopra',
      dob: '2008-02-18'
    });

    const addRes = await teacherAddExistingStudent({
      teacherId: 'teacher_custom_roster',
      admissionNumber: testAdm
    });

    expect(addRes.success).toBe(true);
    expect(addRes.student.full_name).toBe('Deepak Chopra');

    const roster = await getTeacherRoster('teacher_custom_roster');
    const found = roster.find(s => s.admission_number === testAdm);
    expect(found).toBeDefined();
  });

  it('should authenticate student using Admission Number + DOB', async () => {
    const testAdm = `TEST_LOGIN_${Date.now()}`;
    await studentSignup({
      admissionNumber: testAdm,
      fullName: 'Priya Verma',
      dob: '2007-09-20'
    });

    const loginRes = await studentLogin({
      admissionNumber: testAdm,
      dob: '2007-09-20'
    });

    expect(loginRes.token).toBeDefined();
    expect(loginRes.student.full_name).toBe('Priya Verma');
  });

  it('should reject login with wrong DOB or non-existent Admission Number', async () => {
    await expect(
      studentLogin({ admissionNumber: 'NON_EXISTENT_ADM_999', dob: '2005-01-01' })
    ).rejects.toThrow('Invalid Admission Number or Date of Birth');
  });

  it('should allow teacher to create student directly and view roster', async () => {
    const teacherId = '00000000-0000-0000-0000-000000000001';
    const testAdm = `ROSTER_${Date.now()}`;

    await teacherCreateStudent({
      teacherId,
      admissionNumber: testAdm,
      fullName: 'Amit Kumar',
      dob: '2009-01-15'
    });

    const roster = await getTeacherRoster(teacherId);
    expect(Array.isArray(roster)).toBe(true);
    const found = roster.find(s => s.admission_number === testAdm);
    expect(found).toBeDefined();
    expect(found.full_name).toBe('Amit Kumar');
  });
});
