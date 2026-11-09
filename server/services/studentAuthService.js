const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  supabase,
  getAdminClient,
  isConfigured,
  isValidUuid,
} = require('./supabaseClient');
const {
  readLocalStudents,
  writeLocalStudents,
  readSubmissionsLocal,
  readTeacherStudentsLocal,
  writeTeacherStudentsLocal,
  enrollTeacherStudentLocal,
  readExamsLocal
} = require('./localStoreService');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'antigravity_dlp_secret_key_2026';
}

function getSupabaseClient() {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return null;
  }
  return isConfigured() ? getAdminClient() || supabase : null;
}

function formatDob(rawDob) {
  if (!rawDob) return '';
  const str = String(rawDob).trim().replace(/[\/\.]/g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const ddmmyyyy = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return str;
}

function generateStudentToken(student) {
  return jwt.sign(
    {
      studentId: student.id,
      admissionNumber: student.admission_number,
      fullName: student.full_name,
      role: 'student',
    },
    getJwtSecret(),
    { expiresIn: '24h' }
  );
}

/**
 * Verifies whether a teacher UUID exists in `public.teachers` before using it as a foreign key on `students`.
 */
async function resolveVerifiedTeacherUuid(sb, candidateTeacherId) {
  if (!sb || !isValidUuid(candidateTeacherId)) return null;
  try {
    const { data } = await sb
      .from('teachers')
      .select('id')
      .eq('id', candidateTeacherId.trim())
      .maybeSingle();
    return data?.id || null;
  } catch (_) {
    return null;
  }
}

/**
 * Authenticate student via Admission Number + Date of Birth (DOB)
 * Uses Supabase exclusively when configured; falls back to local store only in Vitest/unconfigured mode.
 */
async function studentLogin({ admissionNumber, dob }) {
  if (!admissionNumber || !dob) {
    throw new Error('Admission Number and Date of Birth are required');
  }

  const cleanAdm = String(admissionNumber).trim().toUpperCase();
  const cleanDob = formatDob(dob);

  const sb = getSupabaseClient();
  if (sb) {
    const { data, error } = await sb
      .from('students')
      .select('*')
      .eq('admission_number', cleanAdm)
      .eq('dob', cleanDob)
      .maybeSingle();

    if (error || !data) {
      throw new Error('Invalid Admission Number or Date of Birth. Please check your credentials.');
    }

    const token = generateStudentToken(data);
    return { student: data, token };
  }

  const localList = readLocalStudents();
  const found = localList.find(
    s => s.admission_number.toUpperCase() === cleanAdm && formatDob(s.dob) === cleanDob
  );

  if (!found) {
    throw new Error('Invalid Admission Number or Date of Birth. Please check your credentials.');
  }

  const token = generateStudentToken(found);
  return { student: found, token };
}

function generateAdmissionNumber(prefix = 'DLP') {
  const year = new Date().getFullYear().toString().slice(-2);
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let entropy = '';
  for (let i = 0; i < 5; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    entropy += chars.charAt(randomIndex);
  }
  return `${prefix}-${year}-${entropy}`;
}

/**
 * Generates a permanent 6-character CLASS-XXXXXX code for any teacher ID.
 */
function computeTeacherClassCode(teacherId) {
  if (!teacherId) return 'CLASS-DEMO26';
  const clean = String(teacherId).trim();
  if (clean === 'local-dev-user' || clean === 'dev-fallback-token') return 'CLASS-DEMO26';
  if (clean === 'teacher_general') return 'CLASS-GEN026';

  const hash = crypto.createHash('sha256').update(clean).digest('hex').toUpperCase();
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    const sub = hash.substring(i * 4, i * 4 + 4);
    const num = parseInt(sub, 16);
    code += chars.charAt(num % chars.length);
  }
  return `CLASS-${code}`;
}

/**
 * Resolves a teacher ID from an entered CLASS-XXXXXX code, email, or passcode.
 */
async function resolveTeacherFromClassCode(rawCode) {
  if (!rawCode) return null;
  const clean = String(rawCode).trim();
  const upper = clean.toUpperCase();

  if (upper === 'CLASS-DEMO26' || upper === 'DEMO26' || upper === 'LOCAL-DEV-USER') {
    return 'local-dev-user';
  }
  if (upper === 'CLASS-GEN026' || upper === 'GEN026' || upper === 'TEACHER_GENERAL') {
    return 'teacher_general';
  }

  const validAccessCode =
    process.env.TEACHER_ACCESS_CODE || process.env.APP_PASSWORD || 'dlp_teacher_secret_passcode_2026';
  if (clean === validAccessCode || clean === process.env.APP_PASSWORD || clean === 'admin') {
    return 'teacher_general';
  }

  const sb = getSupabaseClient();
  if (sb) {
    if (isValidUuid(clean)) {
      return await resolveVerifiedTeacherUuid(sb, clean);
    }

    try {
      // 1. Direct match on teacher email
      const { data: teacherByEmail } = await sb
        .from('teachers')
        .select('id')
        .eq('email', clean.toLowerCase())
        .maybeSingle();
      if (teacherByEmail?.id) return teacherByEmail.id;

      // 2. Lookup in teacher_students junction table if class_code was recorded
      const { data: existingClass } = await sb
        .from('teacher_students')
        .select('teacher_id')
        .eq('class_code', upper.startsWith('CLASS-') ? upper : `CLASS-${upper}`)
        .limit(1)
        .maybeSingle();
      if (existingClass?.teacher_id) return existingClass.teacher_id;

      // 3. Scan registered teachers to match deterministic hash
      const { data: allTeachers } = await sb.from('teachers').select('id');
      if (Array.isArray(allTeachers)) {
        for (const t of allTeachers) {
          const expectedCode = computeTeacherClassCode(t.id);
          if (expectedCode === upper || expectedCode.replace('CLASS-', '') === upper.replace('CLASS-', '')) {
            return t.id;
          }
        }
      }
    } catch (_) {}
  }

  // Local fallback
  const localJunction = readTeacherStudentsLocal();
  const foundJunction = localJunction.find(
    r => (r.class_code && r.class_code.toUpperCase() === upper) ||
         (r.class_code && r.class_code.toUpperCase().replace('CLASS-', '') === upper.replace('CLASS-', ''))
  );
  if (foundJunction) return foundJunction.teacher_id;

  if (computeTeacherClassCode('teacher_general') === upper) return 'teacher_general';
  if (computeTeacherClassCode('local-dev-user') === upper) return 'local-dev-user';

  return clean;
}

/**
 * Enrolls a student into a teacher's classroom (multi-tenant teacher_students junction table).
 */
async function enrollStudentInClassroom({ teacherId, studentId, classCode = null, source = 'class_code' }) {
  if (!studentId) return null;
  const effectiveTeacherId = teacherId || 'teacher_general';
  const effectiveClassCode = classCode || computeTeacherClassCode(effectiveTeacherId);
  const sb = getSupabaseClient();

  if (sb) {
    const verifiedTeacherUuid = await resolveVerifiedTeacherUuid(sb, effectiveTeacherId);
    if (verifiedTeacherUuid) {
      try {
        await sb.from('teacher_students').upsert(
          {
            teacher_id: verifiedTeacherUuid,
            student_id: studentId,
            class_code: effectiveClassCode,
            enrollment_source: source,
            enrolled_at: new Date().toISOString()
          },
          { onConflict: 'teacher_id,student_id' }
        );
      } catch (err) {
        console.warn('[teacher_students upsert warning]:', err.message);
      }

      // Also ensure student's primary teacher_id is populated if null
      try {
        await sb
          .from('students')
          .update({ teacher_id: verifiedTeacherUuid })
          .eq('id', studentId)
          .is('teacher_id', null);
      } catch (_) {}
    }
    return { success: true, teacherId: verifiedTeacherUuid || effectiveTeacherId, classCode: effectiveClassCode };
  }

  // Local storage fallback
  enrollTeacherStudentLocal({
    teacherId: effectiveTeacherId,
    studentId,
    classCode: effectiveClassCode,
    enrollmentSource: source
  });

  const localList = readLocalStudents();
  const found = localList.find(s => s.id === studentId || s.admission_number === studentId);
  if (found && !found.teacher_id) {
    found.teacher_id = effectiveTeacherId;
    writeLocalStudents(localList);
  }

  return { success: true, teacherId: effectiveTeacherId, classCode: effectiveClassCode };
}

/**
 * Automatically enrolls a student with the teacher who owns an exam session upon entering code or submitting.
 */
async function autoEnrollStudentWithExamTeacher({ studentId, examId, source = 'live_exam' }) {
  if (!studentId || !examId) return null;
  const sb = getSupabaseClient();
  let teacherId = null;

  if (sb) {
    try {
      const { data: exam } = await sb
        .from('exams')
        .select('teacher_id')
        .eq('id', examId)
        .maybeSingle();
      if (exam?.teacher_id) teacherId = exam.teacher_id;
    } catch (_) {}
  } else {
    const list = readExamsLocal();
    const foundExam = list.find(e => e.id === examId);
    if (foundExam?.teacherId || foundExam?.teacher_id) {
      teacherId = foundExam.teacherId || foundExam.teacher_id;
    }
  }

  if (teacherId) {
    return await enrollStudentInClassroom({ teacherId, studentId, source });
  }
  return null;
}

/**
 * Student connects to a classroom anytime using a permanent CLASS-XXXXXX code.
 */
async function studentJoinClass({ studentId, classCode }) {
  if (!studentId || !classCode) {
    throw new Error('Student ID and Class Code are required.');
  }
  const cleanCode = String(classCode).trim().toUpperCase();
  const teacherId = await resolveTeacherFromClassCode(cleanCode);
  if (!teacherId) {
    throw new Error(`Invalid or unrecognized Class Code: ${cleanCode}`);
  }
  return await enrollStudentInClassroom({
    teacherId,
    studentId,
    classCode: cleanCode,
    source: 'class_code'
  });
}

/**
 * Register a new student profile with Admission Number, Full Name, & DOB.
 * Teacher / Class Code is now completely OPTIONAL.
 */
async function studentSignup({ admissionNumber, fullName, dob, classCode, teacherId }) {
  if (!fullName || !dob) {
    throw new Error('Full Name and Date of Birth are required.');
  }

  const cleanName = String(fullName).trim();
  if (cleanName.length < 2 || cleanName.length > 70) {
    throw new Error('Full Name must be between 2 and 70 characters.');
  }
  if (/https?:\/\/|www\.|<[^>]*>|telegram|whatsapp|\.ru|\.xyz/i.test(cleanName)) {
    throw new Error('Invalid name: promotional content and links are prohibited.');
  }

  const cleanDob = formatDob(dob);
  const birthYear = parseInt(cleanDob.split('-')[0], 10);
  const currentYear = new Date().getFullYear();
  if (isNaN(birthYear) || birthYear < 1940 || birthYear > currentYear - 3) {
    throw new Error('Please enter a valid Date of Birth.');
  }

  const cleanTeacherInput = (classCode || teacherId || '').trim();
  let resolvedTeacherId = null;
  let resolvedClassCode = null;

  if (cleanTeacherInput) {
    resolvedTeacherId = await resolveTeacherFromClassCode(cleanTeacherInput);
    resolvedClassCode = cleanTeacherInput.toUpperCase().startsWith('CLASS-')
      ? cleanTeacherInput.toUpperCase()
      : `CLASS-${cleanTeacherInput.toUpperCase()}`;
  }

  // Institutional Closed-Registration Mode: if REQUIRE_CLASS_CODE_FOR_SIGNUP is active,
  // public self-registration without a valid teacher's class code is rejected.
  const requireClassCode = process.env.REQUIRE_CLASS_CODE_FOR_SIGNUP === 'true';
  if (requireClassCode && !resolvedTeacherId) {
    throw new Error('A valid Classroom Code (CLASS-XXXXXX) is required to register.');
  }

  const rawAdm = admissionNumber ? String(admissionNumber).trim() : generateAdmissionNumber();
  let cleanAdm = rawAdm.replace(/[^A-Z0-9_\-]/gi, '').toUpperCase();
  if (!cleanAdm) {
    cleanAdm = generateAdmissionNumber();
  }

  const newStudent = {
    id: `stu_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    admission_number: cleanAdm,
    full_name: cleanName,
    dob: cleanDob,
    teacher_id: resolvedTeacherId || null,
    created_at: new Date().toISOString(),
  };

  const sb = getSupabaseClient();
  let registeredStudent = null;

  if (sb) {
    let { data, error } = await sb
      .from('students')
      .insert([newStudent])
      .select()
      .single();

    // Retry with teacher_id: null if foreign key fails
    if (error && error.code === '23503' && newStudent.teacher_id) {
      const retryRes = await sb
        .from('students')
        .insert([{ ...newStudent, teacher_id: null }])
        .select()
        .single();
      data = retryRes.data;
      error = retryRes.error;
    }

    if (error && error.code === '23505') {
      throw new Error(`Admission Number "${cleanAdm}" is already registered. Please log in.`);
    }
    if (error) {
      throw new Error(`Failed to register student in Supabase: ${error.message}`);
    }
    registeredStudent = data;
  } else {
    const localList = readLocalStudents();
    const existing = localList.find(s => s.admission_number.toUpperCase() === cleanAdm);
    if (existing) {
      throw new Error(`Admission Number "${cleanAdm}" is already registered. Please log in.`);
    }

    localList.unshift(newStudent);
    writeLocalStudents(localList);
    registeredStudent = newStudent;
  }

  // If a class code or teacher was resolved, enroll in teacher_students junction
  if (resolvedTeacherId && registeredStudent) {
    try {
      await enrollStudentInClassroom({
        teacherId: resolvedTeacherId,
        studentId: registeredStudent.id,
        classCode: resolvedClassCode,
        source: 'class_code'
      });
    } catch (_) {}
  }

  const token = generateStudentToken(registeredStudent);
  return { student: registeredStudent, token };
}

/**
 * Fetch all exam submissions for a given student ID.
 * Normalizes `testTitle`, `finalScore`, `questions`, and `studentAnswers` for `StudentPortal.jsx`.
 */
async function getStudentSubmissions(studentId) {
  if (!studentId) return [];

  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('submissions')
        .select('*, exams(title, subject, grade)')
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(row => {
          const resp =
            row.responses && typeof row.responses === 'string'
              ? JSON.parse(row.responses)
              : row.responses || {};
          return {
            ...resp,
            ...row,
            testTitle: row.exams?.title || resp.testTitle || 'Mathematics Assessment',
            examTitle: row.exams?.title || resp.testTitle || 'Mathematics Assessment',
          };
        });
      }
    } catch (_) {}
    return [];
  }

  const allSubmissions = readSubmissionsLocal();
  return allSubmissions.filter(s => s.student_id === studentId || s.studentId === studentId);
}

/**
 * Teacher adds a student to their roster
 */
async function teacherCreateStudent({ teacherId, admissionNumber, fullName, dob }) {
  return await studentSignup({
    admissionNumber,
    fullName,
    dob,
    teacherId: teacherId || 'teacher_general',
  });
}

/**
 * Get all students enrolled under a specific teacher profile.
 * Supports multi-tenant classrooms via teacher_students junction table and students.teacher_id.
 */
async function getTeacherRoster(teacherId) {
  const effectiveTeacherId = teacherId || 'teacher_general';
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const studentMap = new Map();

      // 1. Fetch students from teacher_students junction table
      if (isValidUuid(effectiveTeacherId)) {
        const { data: junctionRows } = await sb
          .from('teacher_students')
          .select('student_id, enrolled_at, enrollment_source, class_code, students(*)')
          .eq('teacher_id', effectiveTeacherId);

        if (Array.isArray(junctionRows)) {
          for (const row of junctionRows) {
            if (row.students) {
              studentMap.set(row.students.id, {
                ...row.students,
                enrolled_at: row.enrolled_at,
                enrollment_source: row.enrollment_source,
                class_code: row.class_code,
              });
            }
          }
        }
      }

      // 2. Also union with students table where teacher_id matches or is null (shared roster)
      let query = sb.from('students').select('*').order('created_at', { ascending: false });
      if (isValidUuid(effectiveTeacherId)) {
        query = query.or(`teacher_id.eq.${effectiveTeacherId},teacher_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        for (const s of data) {
          if (!studentMap.has(s.id)) {
            studentMap.set(s.id, s);
          }
        }
      }

      return Array.from(studentMap.values());
    } catch (err) {
      console.warn('[Supabase Roster Query Warning]:', err.message);
    }
    return [];
  }

  // Local fallback
  const junctionLocal = readTeacherStudentsLocal();
  const localList = readLocalStudents();
  const enrolledStudentIds = new Set(
    junctionLocal
      .filter(
        r =>
          r.teacher_id === effectiveTeacherId ||
          r.teacher_id === 'local-dev-user' ||
          r.teacher_id === 'teacher_general'
      )
      .map(r => r.student_id)
  );

  return localList.filter(
    s =>
      enrolledStudentIds.has(s.id) ||
      !s.teacher_id ||
      s.teacher_id === effectiveTeacherId ||
      s.teacher_id === 'local-dev-user' ||
      s.teacher_id === 'teacher_general'
  );
}

/**
 * Fetch a comprehensive Candidate Dossier (student profile + all matching exam submissions + aggregate stats)
 */
async function getStudentDossier(studentId) {
  if (!studentId) {
    throw new Error('Student ID is required');
  }

  let student = null;
  let submissions = [];
  const sb = getSupabaseClient();

  if (sb) {
    const { data: stData } = await sb
      .from('students')
      .select('*')
      .or(`id.eq.${studentId},admission_number.eq.${studentId}`)
      .maybeSingle();
    student = stData;

    if (!student) {
      throw new Error('Student record not found');
    }

    const { data: subData } = await sb
      .from('submissions')
      .select('*, exams(title, subject, grade)')
      .order('submitted_at', { ascending: false });

    const allSubs = Array.isArray(subData) ? subData : [];
    const targetName = (student.full_name || '').trim().toLowerCase();
    const targetAdm = (student.admission_number || '').trim().toUpperCase();

    submissions = allSubs.filter(sub => {
      const resp = sub.responses && typeof sub.responses === 'object' ? sub.responses : {};
      const sId = sub.student_id || resp.studentId || resp.student_id;
      const sName = (sub.student_name || resp.studentName || '').trim().toLowerCase();
      return (
        sId === student.id ||
        (targetAdm && sName.toUpperCase().includes(targetAdm)) ||
        (targetName && sName === targetName)
      );
    });
  } else {
    const localStudents = readLocalStudents();
    student = localStudents.find(
      s =>
        s.id === studentId ||
        (s.admission_number && s.admission_number.toUpperCase() === String(studentId).toUpperCase())
    );
    if (!student) {
      throw new Error('Student record not found');
    }

    const allSubs = readSubmissionsLocal();
    const targetName = (student.full_name || '').trim().toLowerCase();
    const targetAdm = (student.admission_number || '').trim().toUpperCase();

    submissions = allSubs.filter(sub => {
      const resp = sub.responses && typeof sub.responses === 'object' ? sub.responses : {};
      const sId = sub.student_id || sub.studentId || resp.studentId || resp.student_id;
      const sName = (sub.student_name || sub.studentName || resp.studentName || '').trim().toLowerCase();
      return (
        sId === student.id ||
        (targetAdm && sName.toUpperCase().includes(targetAdm)) ||
        (targetName && sName === targetName)
      );
    });
  }

  const normalizedSubmissions = submissions.map(item => {
    const resp = item.responses
      ? typeof item.responses === 'string'
        ? JSON.parse(item.responses)
        : item.responses
      : item;
    const pct = Number(item.percentage ?? resp.finalScore?.percentage ?? resp.autoGraded?.percentage ?? 0);
    const score = Number(item.total_score ?? resp.finalScore?.score ?? resp.autoGraded?.score ?? 0);
    const maxScore = Number(
      item.max_possible ??
        resp.finalScore?.total ??
        resp.autoGraded?.total ??
        (Array.isArray(resp.questions) ? resp.questions.length : 0)
    );
    return {
      id: item.id || resp.id,
      examId: item.exam_id || resp.examId,
      testTitle: item.exams?.title || resp.testTitle || 'Mathematics Examination',
      submittedAt: item.submitted_at || resp.submittedAt,
      score,
      maxScore,
      percentage: pct,
      timeTakenSeconds: item.time_taken_seconds || resp.timeTakenSeconds || 0,
      cheatingFlagged: Boolean(resp.cheatingFlagged),
      cheatingReason: resp.cheatingReason || '',
      questions: resp.questions || [],
      studentAnswers: resp.studentAnswers || {},
      status: resp.status || 'reviewed',
    };
  });

  const totalAttempts = normalizedSubmissions.length;
  const averagePercentage =
    totalAttempts > 0
      ? Math.round(
          normalizedSubmissions.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0) / totalAttempts
        )
      : 0;
  const bestPercentage =
    totalAttempts > 0 ? Math.max(...normalizedSubmissions.map(s => Number(s.percentage) || 0)) : 0;
  const flaggedAttempts = normalizedSubmissions.filter(s => s.cheatingFlagged).length;

  return {
    student,
    metrics: {
      totalAttempts,
      averagePercentage,
      bestPercentage,
      flaggedAttempts,
    },
    submissions: normalizedSubmissions,
  };
}

/**
 * Update a student's identity record (name, admission number, or DOB)
 */
async function updateStudentProfile(studentId, { fullName, admissionNumber, dob }) {
  if (!studentId) throw new Error('Student ID is required');
  const updates = {};
  if (fullName && String(fullName).trim()) updates.full_name = String(fullName).trim();
  if (admissionNumber && String(admissionNumber).trim()) {
    updates.admission_number = String(admissionNumber).trim().replace(/[^A-Z0-9_\-]/gi, '').toUpperCase();
  }
  if (dob && String(dob).trim()) updates.dob = formatDob(dob);

  const sb = getSupabaseClient();
  if (sb) {
    updates.updated_at = new Date().toISOString();
    const { data, error } = await sb
      .from('students')
      .update(updates)
      .eq('id', studentId)
      .select()
      .single();
    if (error) throw new Error(`Failed to update student: ${error.message}`);
    return data;
  }

  const localList = readLocalStudents();
  const idx = localList.findIndex(s => s.id === studentId);
  if (idx === -1) throw new Error('Student not found');
  localList[idx] = { ...localList[idx], ...updates };
  writeLocalStudents(localList);
  return localList[idx];
}

/**
 * Remove a student from the roster
 */
async function deleteStudentProfile(studentId) {
  if (!studentId) throw new Error('Student ID is required');
  const sb = getSupabaseClient();
  if (sb) {
    const { error } = await sb.from('students').delete().eq('id', studentId);
    if (error) throw new Error(`Failed to remove student: ${error.message}`);
    return { deleted: true, id: studentId };
  }

  const localList = readLocalStudents();
  const filtered = localList.filter(s => s.id !== studentId);
  writeLocalStudents(filtered);
  return { deleted: true, id: studentId };
}

const entitySalts = new Map();
const activeCodeToTeacherMap = new Map();

function getEntitySalt(entityId) {
  if (!entitySalts.has(entityId)) {
    entitySalts.set(entityId, 'salt_v1');
  }
  return entitySalts.get(entityId);
}

function regenerateEntitySalt(entityId) {
  const newSalt = `salt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  entitySalts.set(entityId, newSalt);
  return newSalt;
}

function computeRollingRefCodeWithSalt(entityId, prefix = 'REF', offsetWindows = 0, salt = 'salt_v1') {
  const windowMs = 5 * 60 * 1000;
  const currentWindowIndex = Math.floor(Date.now() / windowMs) + offsetWindows;
  const secret = getJwtSecret();

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${entityId}:${salt}:${currentWindowIndex}`);
  const hashHex = hmac.digest('hex');

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    const sub = hashHex.substring(i * 4, i * 4 + 4);
    const num = parseInt(sub, 16);
    code += chars.charAt(num % chars.length);
  }

  return `${prefix.toUpperCase()}-${code}`;
}

function get5MinRollingRefCode(entityId, prefix = 'REF', offsetWindows = 0) {
  const salt = getEntitySalt(entityId);
  const formattedCode = computeRollingRefCodeWithSalt(entityId, prefix, offsetWindows, salt);
  if (prefix.toUpperCase() === 'TCH') {
    activeCodeToTeacherMap.set(formattedCode, entityId);
  }
  return formattedCode;
}

function matchesEntityRollingRefCode(entityId, prefix, targetCode) {
  const cleanTarget = String(targetCode || '').trim().toUpperCase();
  if (!cleanTarget) return false;
  const currentSalt = getEntitySalt(entityId);
  const saltsToCheck = currentSalt === 'salt_v1' ? ['salt_v1'] : [currentSalt, 'salt_v1'];
  for (const salt of saltsToCheck) {
    if (
      cleanTarget === computeRollingRefCodeWithSalt(entityId, prefix, 0, salt) ||
      cleanTarget === computeRollingRefCodeWithSalt(entityId, prefix, -1, salt)
    ) {
      return true;
    }
  }
  return false;
}

function getRefCodeSecondsLeft() {
  const windowMs = 5 * 60 * 1000;
  const elapsedMs = Date.now() % windowMs;
  return Math.max(1, Math.ceil((windowMs - elapsedMs) / 1000));
}

async function studentLinkToTeacher({ studentId, teacherRefCode }) {
  if (!studentId || !teacherRefCode) {
    throw new Error('Student ID and Teacher Reference Code are required.');
  }

  const cleanCode = String(teacherRefCode).trim().toUpperCase();
  let matchedTeacherId = null;

  if (activeCodeToTeacherMap.has(cleanCode)) {
    matchedTeacherId = activeCodeToTeacherMap.get(cleanCode);
  }

  const sb = getSupabaseClient();
  if (!matchedTeacherId && sb) {
    try {
      const { data: teachers } = await sb.from('teachers').select('id, email');
      if (Array.isArray(teachers)) {
        for (const t of teachers) {
          if (matchesEntityRollingRefCode(t.id, 'TCH', cleanCode)) {
            matchedTeacherId = t.id;
            break;
          }
        }
      }
    } catch (_) {}
  }

  if (!matchedTeacherId) {
    const defaultTeachers = ['teacher_general', 'local-dev-user', 'default_teacher', 'admin'];
    for (const tId of defaultTeachers) {
      if (matchesEntityRollingRefCode(tId, 'TCH', cleanCode)) {
        matchedTeacherId = tId;
        break;
      }
    }
  }

  if (!matchedTeacherId) {
    throw new Error('Invalid or expired Teacher Reference Code. Passcodes refresh every 5 minutes.');
  }

  if (sb) {
    const dbTeacherId = await resolveVerifiedTeacherUuid(sb, matchedTeacherId);
    await sb
      .from('students')
      .update({ teacher_id: dbTeacherId, updated_at: new Date().toISOString() })
      .or(`id.eq.${studentId},admission_number.eq.${studentId}`);
    return { success: true, teacherId: matchedTeacherId };
  }

  const localList = readLocalStudents();
  const cleanId = String(studentId).trim().toUpperCase();
  const found = localList.find(
    s =>
      s.id === studentId ||
      (s.admission_number && s.admission_number.toUpperCase() === cleanId)
  );
  if (found) {
    found.teacher_id = matchedTeacherId;
    writeLocalStudents(localList);
  }

  return { success: true, teacherId: matchedTeacherId };
}

async function teacherAddExistingStudent({ teacherId, admissionNumber, studentRefCode, fullName }) {
  const rawAdm = admissionNumber ? String(admissionNumber).trim() : '';
  const rawCode = studentRefCode ? String(studentRefCode).trim() : '';
  const rawName = fullName ? String(fullName).trim() : '';

  if (!rawAdm && !rawCode && !rawName) {
    throw new Error('Please enter a Roll Number, Candidate Name, or 5-Minute Student Ref Code.');
  }

  const cleanAdm = rawAdm.toUpperCase();
  const strippedAdm = rawAdm.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const cleanCode = rawCode.toUpperCase();
  const cleanNameQuery = (rawName || rawAdm).toLowerCase();

  let candidatePool = [];
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data } = await sb.from('students').select('*').order('created_at', { ascending: false });
      if (Array.isArray(data)) {
        candidatePool = data;
      }
    } catch (_) {}
  } else {
    candidatePool = readLocalStudents();
  }

  let targetStudent = null;

  // 1. Try 5-min rolling ref code
  const targetCode = cleanCode.startsWith('STU-')
    ? cleanCode
    : cleanAdm.startsWith('STU-')
    ? cleanAdm
    : cleanCode;
  if (targetCode) {
    for (const s of candidatePool) {
      if (matchesEntityRollingRefCode(s.id, 'STU', targetCode)) {
        targetStudent = s;
        break;
      }
    }
  }

  // 2. Try Roll Number (exact, prefix, or stripped match)
  if (!targetStudent && (cleanAdm || strippedAdm)) {
    targetStudent = candidatePool.find(s => {
      const sAdm = (s.admission_number || s.admissionNumber || '').toUpperCase();
      const sId = (s.id || '').toUpperCase();
      const sStripped = sAdm.replace(/[^A-Z0-9]/gi, '');
      return (
        sAdm === cleanAdm ||
        sId === cleanAdm ||
        (strippedAdm && sStripped === strippedAdm) ||
        (cleanAdm.length >= 4 && sAdm.includes(cleanAdm))
      );
    });
  }

  // 3. Try Candidate Name
  if (!targetStudent && cleanNameQuery) {
    targetStudent = candidatePool.find(s => {
      const sName = (s.full_name || s.fullName || '').toLowerCase();
      return sName === cleanNameQuery || (cleanNameQuery.length >= 3 && sName.includes(cleanNameQuery));
    });
  }

  if (!targetStudent) {
    throw new Error(`No student found matching "${rawAdm || rawCode || rawName}". Please verify registration.`);
  }

  const effectiveTeacherId = teacherId || 'teacher_general';

  // Multi-tenant enrollment into teacher_students
  await enrollStudentInClassroom({
    teacherId: effectiveTeacherId,
    studentId: targetStudent.id,
    source: 'manual_lookup',
  });

  return { success: true, student: targetStudent };
}

module.exports = {
  studentLogin,
  studentSignup,
  getStudentSubmissions,
  teacherCreateStudent,
  getTeacherRoster,
  getStudentDossier,
  updateStudentProfile,
  deleteStudentProfile,
  formatDob,
  generateAdmissionNumber,
  get5MinRollingRefCode,
  getRefCodeSecondsLeft,
  regenerateEntitySalt,
  studentLinkToTeacher,
  teacherAddExistingStudent,
  computeTeacherClassCode,
  resolveTeacherFromClassCode,
  enrollStudentInClassroom,
  autoEnrollStudentWithExamTeacher,
  studentJoinClass,
};
