import { describe, it, expect } from 'vitest';
import {
  studentLogin,
  studentSignup,
  getStudentSubmissions,
  teacherCreateStudent,
  getTeacherRoster,
  formatDob
} from '../services/studentAuthService.js';

describe('Student Authentication & Roster Service Integration', () => {
  it('should correctly format DOB strings into standard YYYY-MM-DD', () => {
    expect(formatDob('2008-05-15')).toBe('2008-05-15');
    expect(formatDob('2008/05/15')).toBe('2008-05-15');
  });

  it('should register a new student with Admission Number, Full Name, and DOB', async () => {
    const testAdm = `TEST_${Date.now()}`;
    const result = await studentSignup({
      admissionNumber: testAdm,
      fullName: 'Rahul Sharma',
      dob: '2008-04-10'
    });

    expect(result).toBeDefined();
    expect(result.token).toBeDefined();
    expect(result.student.admission_number).toBe(testAdm);
    expect(result.student.full_name).toBe('Rahul Sharma');
    expect(result.student.dob).toBe('2008-04-10');
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

  it('should allow teacher to create student and view teacher roster', async () => {
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
