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
const { isDemoOrFallbackAllowed } = require('./authService');

function getJwtSecret() {
  const raw = typeof process.env.JWT_SECRET === 'string' ? process.env.JWT_SECRET.trim() : '';
  const isPlaceholder =
    !raw || raw.includes('your_jwt_secret') || raw.includes('placeholder');
  if (!isPlaceholder) {
    return raw;
  }
  if (isDemoOrFallbackAllowed()) {
    return 'antigravity_dlp_secret_key_2026';
  }
  const err = new Error(
    'Server configuration error: JWT_SECRET environment variable is required in production.'
  );
  err.statusCode = 503;
  throw err;
}

function ensureDurableOrDev(sb) {
  if (!sb && !isDemoOrFallbackAllowed()) {
    const err = new Error(
      'Durable Supabase persistence is required in production. Configure SUPABASE_URL and SUPABASE_SECRET_KEY.'
    );
    err.statusCode = 503;
    throw err;
  }
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
 * Safely locates a student row by `id` or uppercase `admission_number` using parameterized `.eq()` filters
 * (never interpolating unvalidated input into `.or(...)` expressions).
 */
async function findStudentRow(sb, identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) return null;

  if (sb) {
    const byId = await sb.from('students').select('*').eq('id', raw).maybeSingle();
    if (byId.error) {
      throw new Error(`Database error looking up student: ${byId.error.message}`);
    }
    if (byId.data) return byId.data;

    const byAdm = await sb
      .from('students')
      .select('*')
      .eq('admission_number', raw.toUpperCase())
      .maybeSingle();
    if (byAdm.error) {
      throw new Error(`Database error looking up student: ${byAdm.error.message}`);
    }
    return byAdm.data || null;
  }

  ensureDurableOrDev(sb);
  const localStudents = readLocalStudents();
  const upper = raw.toUpperCase();
  return (
    localStudents.find(
      (s) => s.id === raw || (s.admission_number && s.admission_number.toUpperCase() === upper)
    ) || null
  );
}

/**
 * Verifies whether a teacher owns or has explicitly enrolled a given student.
 */
async function isStudentEnrolledWithTeacher(sb, student, teacherId) {
  if (!student || !teacherId) return false;
  if (sb) {
    if (!isValidUuid(teacherId)) return false;
    if (student.teacher_id === teacherId) return true;
    const { data, error } = await sb
      .from('teacher_students')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('student_id', student.id)
      .maybeSingle();
    if (error) {
      throw new Error(`Database error checking classroom enrollment: ${error.message}`);
    }
    return Boolean(data?.id);
  }

  if (student.teacher_id && student.teacher_id === teacherId) {
    return true;
  }
  const junctionLocal = readTeacherStudentsLocal();
  return junctionLocal.some(
    (r) => r.teacher_id === teacherId && r.student_id === student.id
  );
}

/**
 * Authenticate student via Admission Number + Date of Birth (DOB)
 * Uses Supabase exclusively when configured; falls back to local store only in Vitest/unconfigured dev mode.
 */
async function studentLogin({ admissionNumber, dob }) {
  if (!admissionNumber || !dob) {
    throw new Error('Admission Number and Date of Birth are required');
  }

  const cleanAdm = String(admissionNumber).trim().toUpperCase();
  const cleanDob = formatDob(dob);

  const sb = getSupabaseClient();
  ensureDurableOrDev(sb);

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
 * Resolves a verified teacher ID from an entered CLASS-XXXXXX code or registered teacher email.
 * Hardcoded demo passcodes and local junction fallbacks are strictly disabled in production.
 */
async function resolveTeacherFromClassCode(rawCode) {
  if (!rawCode) return null;
  const clean = String(rawCode).trim();
  const upper = clean.toUpperCase();
  const allowDemo = isDemoOrFallbackAllowed();

  if (allowDemo) {
    if (upper === 'CLASS-DEMO26' || upper === 'DEMO26' || upper === 'LOCAL-DEV-USER') {
      return 'local-dev-user';
    }
    if (upper === 'CLASS-GEN026' || upper === 'GEN026' || upper === 'TEACHER_GENERAL') {
      return 'teacher_general';
    }
    const devPasscodes = [
      process.env.TEACHER_ACCESS_CODE,
      process.env.APP_PASSWORD,
      'dlp_teacher_secret_passcode_2026',
      'admin',
    ].filter(Boolean);
    if (devPasscodes.includes(clean)) {
      return 'teacher_general';
    }
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
      const normalizedClassCode = upper.startsWith('CLASS-') ? upper : `CLASS-${upper}`;
      const { data: existingClass } = await sb
        .from('teacher_students')
        .select('teacher_id')
        .eq('class_code', normalizedClassCode)
        .limit(1)
        .maybeSingle();
      if (existingClass?.teacher_id) return existingClass.teacher_id;

      // 3. Scan registered teachers to match deterministic hash
      const strippedUpper = upper.replace(/^CLASS-/, '');
      const { data: allTeachers } = await sb.from('teachers').select('id');
      if (Array.isArray(allTeachers)) {
        for (const t of allTeachers) {
          const expectedCode = computeTeacherClassCode(t.id);
          if (expectedCode === upper || expectedCode.replace('CLASS-', '') === strippedUpper) {
            return t.id;
          }
        }
      }
    } catch (_) {}

    return null;
  }

  if (!allowDemo) {
    return null;
  }

  // Local dev/test fallback
  const localJunction = readTeacherStudentsLocal();
  const strippedUpper = upper.replace(/^CLASS-/, '');
  const foundJunction = localJunction.find(
    r =>
      (r.class_code && r.class_code.toUpperCase() === upper) ||
      (r.class_code && r.class_code.toUpperCase().replace(/^CLASS-/, '') === strippedUpper)
  );
  if (foundJunction) return foundJunction.teacher_id;

  if (computeTeacherClassCode('teacher_general') === upper) return 'teacher_general';
  if (computeTeacherClassCode('local-dev-user') === upper) return 'local-dev-user';

  return null;
}

/**
 * Enrolls a student into a teacher's classroom (multi-tenant teacher_students junction table).
 */
async function enrollStudentInClassroom({ teacherId, studentId, classCode = null, source = 'class_code' }) {
  if (!studentId || !teacherId) {
    const err = new Error('Teacher ID and Student ID are required for enrollment.');
    err.statusCode = 400;
    throw err;
  }
  const effectiveTeacherId = String(teacherId).trim();
  const effectiveClassCode = classCode || computeTeacherClassCode(effectiveTeacherId);
  const sb = getSupabaseClient();
  ensureDurableOrDev(sb);

  if (sb) {
    const verifiedTeacherUuid = await resolveVerifiedTeacherUuid(sb, effectiveTeacherId);
    if (!verifiedTeacherUuid) {
      const err = new Error('Target teacher account could not be verified.');
      err.statusCode = 403;
      throw err;
    }

    const { error: upsertErr } = await sb.from('teacher_students').upsert(
      {
        teacher_id: verifiedTeacherUuid,
        student_id: studentId,
        class_code: effectiveClassCode,
        enrollment_source: source,
        enrolled_at: new Date().toISOString()
      },
      { onConflict: 'teacher_id,student_id' }
    );
    if (upsertErr) {
      throw new Error(`Failed to enroll student into classroom: ${upsertErr.message}`);
    }

    // Also ensure student's primary teacher_id is populated if null
    await sb
      .from('students')
      .update({ teacher_id: verifiedTeacherUuid })
      .eq('id', studentId)
      .is('teacher_id', null);

    return { success: true, teacherId: verifiedTeacherUuid, classCode: effectiveClassCode };
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
  } else if (isDemoOrFallbackAllowed()) {
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
  const sb = getSupabaseClient();
  ensureDurableOrDev(sb);

  const student = await findStudentRow(sb, studentId);
  if (!student) {
    const err = new Error('Student record not found.');
    err.statusCode = 404;
    throw err;
  }

  const cleanCode = String(classCode).trim().toUpperCase();
  const teacherId = await resolveTeacherFromClassCode(cleanCode);
  if (!teacherId) {
    throw new Error(`Invalid or unrecognized Class Code: ${cleanCode}`);
  }
  const canonicalClassCode = computeTeacherClassCode(teacherId);
  return await enrollStudentInClassroom({
    teacherId,
    studentId: student.id,
    classCode: canonicalClassCode,
    source: 'class_code'
  });
}

/**
 * Register a new student profile with Admission Number, Full Name, & DOB.
 * Classroom Code (CLASS-XXXXXX) is optional unless REQUIRE_CLASS_CODE_FOR_SIGNUP is enabled.
 */
async function studentSignup({ admissionNumber, fullName, dob, classCode, teacherId }) {
  if (!fullName || !dob) {
    throw new Error('Full Name and Date of Birth are required.');
  }

  const sb = getSupabaseClient();
  ensureDurableOrDev(sb);

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

  const cleanClassCode = classCode ? String(classCode).trim() : '';
  const cleanTeacherId = teacherId ? String(teacherId).trim() : '';
  let resolvedTeacherId = null;
  let resolvedClassCode = null;

  if (cleanClassCode) {
    resolvedTeacherId = await resolveTeacherFromClassCode(cleanClassCode);
    if (!resolvedTeacherId) {
      throw new Error(
        `Invalid or unrecognized Classroom Code "${cleanClassCode.toUpperCase()}". Leave the field blank to register independently.`
      );
    }
    resolvedClassCode = computeTeacherClassCode(resolvedTeacherId);
  } else if (cleanTeacherId) {
    if (sb) {
      resolvedTeacherId = await resolveVerifiedTeacherUuid(sb, cleanTeacherId);
      if (!resolvedTeacherId) {
        const err = new Error('Verified teacher account required for classroom enrollment.');
        err.statusCode = 403;
        throw err;
      }
    } else {
      resolvedTeacherId = cleanTeacherId;
    }
    resolvedClassCode = computeTeacherClassCode(resolvedTeacherId);
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

  let registeredStudent = null;

  if (sb) {
    const { data, error } = await sb
      .from('students')
      .insert([newStudent])
      .select()
      .single();

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
    await enrollStudentInClassroom({
      teacherId: resolvedTeacherId,
      studentId: registeredStudent.id,
      classCode: resolvedClassCode,
      source: 'class_code'
    });
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
  if (!teacherId) {
    const err = new Error('Teacher authentication is required to enroll students.');
    err.statusCode = 403;
    throw err;
  }
  return await studentSignup({
    admissionNumber,
    fullName,
    dob,
    teacherId,
  });
}

/**
 * Get all students enrolled under a specific teacher profile.
 * Strictly isolated by `teacher_students` junction table and `students.teacher_id === teacherId`.
 */
async function getTeacherRoster(teacherId) {
  if (!teacherId) {
    const err = new Error('Teacher authentication is required to view student roster.');
    err.statusCode = 403;
    throw err;
  }
  const effectiveTeacherId = String(teacherId).trim();
  const sb = getSupabaseClient();
  ensureDurableOrDev(sb);

  if (sb) {
    if (!isValidUuid(effectiveTeacherId)) {
      if (!isDemoOrFallbackAllowed()) {
        const err = new Error('Verified teacher account is required to view student roster.');
        err.statusCode = 403;
        throw err;
      }
      return [];
    }

    const studentMap = new Map();

    // 1. Fetch students explicitly enrolled via teacher_students junction table
    const { data: junctionRows, error: jErr } = await sb
      .from('teacher_students')
      .select('student_id, enrolled_at, enrollment_source, class_code, students(*)')
      .eq('teacher_id', effectiveTeacherId);

    if (jErr) {
      throw new Error(`Failed to load enrolled classroom roster: ${jErr.message}`);
    }

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

    // 2. Also include students whose primary teacher_id strictly matches this teacher
    const { data, error } = await sb
      .from('students')
      .select('*')
      .eq('teacher_id', effectiveTeacherId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to query student roster: ${error.message}`);
    }

    if (Array.isArray(data)) {
      for (const s of data) {
        if (!studentMap.has(s.id)) {
          studentMap.set(s.id, s);
        }
      }
    }

    return Array.from(studentMap.values());
  }

  // Local fallback (strictly scoped to effectiveTeacherId — never includes unassigned or other teachers' students)
  const junctionLocal = readTeacherStudentsLocal();
  const localList = readLocalStudents();
  const enrolledStudentIds = new Set(
    junctionLocal
      .filter(r => r.teacher_id === effectiveTeacherId)
      .map(r => r.student_id)
  );

  return localList.filter(
    s => enrolledStudentIds.has(s.id) || s.teacher_id === effectiveTeacherId
  );
}

/**
 * Fetch a comprehensive Candidate Dossier (student profile + teacher-scoped exam submissions + aggregate stats).
 * Enforces teacher ownership verification against `teacherId`.
 */
async function getStudentDossier(studentId, teacherId) {
  if (!studentId) {
    const err = new Error('Student ID is required');
    err.statusCode = 400;
    throw err;
  }
  if (!teacherId) {
    const err = new Error('Forbidden: Teacher scope is required to access student dossiers.');
    err.statusCode = 403;
    throw err;
  }

  const sb = getSupabaseClient();
  ensureDurableOrDev(sb);

  const student = await findStudentRow(sb, studentId);
  if (!student) {
    const err = new Error('Student record not found');
    err.statusCode = 404;
    throw err;
  }

  const enrolled = await isStudentEnrolledWithTeacher(sb, student, teacherId);
  if (!enrolled) {
    const err = new Error('Forbidden: You do not have access to this student record.');
    err.statusCode = 403;
    throw err;
  }

  let submissions = [];

  if (sb) {
    const { data: subData, error: subErr } = await sb
      .from('submissions')
      .select('*, exams!inner(title, subject, grade, teacher_id)')
      .eq('student_id', student.id)
      .eq('exams.teacher_id', teacherId)
      .order('submitted_at', { ascending: false });

    if (subErr) {
      throw new Error(`Failed to load student submissions: ${subErr.message}`);
    }
    submissions = Array.isArray(subData) ? subData : [];
  } else {
    const allSubs = readSubmissionsLocal();
    const localExams = readExamsLocal();
    const examOwnerMap = new Map(
      localExams.map(e => [e.id, e.teacherId || e.teacher_id || null])
    );

    submissions = allSubs.filter(sub => {
      const resp = sub.responses && typeof sub.responses === 'object' ? sub.responses : {};
      const sId = sub.student_id || sub.studentId || resp.studentId || resp.student_id;
      if (sId !== student.id) return false;
      const exId = sub.exam_id || sub.examId || resp.examId || resp.exam_id;
      const exOwner = exId ? examOwnerMap.get(exId) : null;
      if (exOwner && exOwner !== teacherId) return false;
      return true;
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
 * Update a student's identity record (name, admission number, or DOB).
 * Enforces teacher ownership verification against `teacherId`.
 */
async function updateStudentProfile(studentId, { fullName, admissionNumber, dob }, teacherId) {
  if (!studentId) {
    const err = new Error('Student ID is required');
    err.statusCode = 400;
    throw err;
  }
  if (!teacherId) {
    const err = new Error('Forbidden: Teacher scope is required to update students.');
    err.statusCode = 403;
    throw err;
  }

  const sb = getSupabaseClient();
  ensureDurableOrDev(sb);

  const student = await findStudentRow(sb, studentId);
  if (!student) {
    const err = new Error('Student record not found');
    err.statusCode = 404;
    throw err;
  }

  const enrolled = await isStudentEnrolledWithTeacher(sb, student, teacherId);
  if (!enrolled) {
    const err = new Error('Forbidden: You do not have permission to update this student.');
    err.statusCode = 403;
    throw err;
  }

  const updates = {};
  if (fullName && String(fullName).trim()) updates.full_name = String(fullName).trim();
  if (admissionNumber && String(admissionNumber).trim()) {
    updates.admission_number = String(admissionNumber).trim().replace(/[^A-Z0-9_\-]/gi, '').toUpperCase();
  }
  if (dob && String(dob).trim()) updates.dob = formatDob(dob);

  if (sb) {
    updates.updated_at = new Date().toISOString();
    const { data, error } = await sb
      .from('students')
      .update(updates)
      .eq('id', student.id)
      .select()
      .single();
    if (error) throw new Error(`Failed to update student: ${error.message}`);
    return data;
  }

  const localList = readLocalStudents();
  const idx = localList.findIndex(s => s.id === student.id);
  if (idx === -1) {
    const err = new Error('Student not found');
    err.statusCode = 404;
    throw err;
  }
  if (
    updates.admission_number &&
    localList.some((s, i) => i !== idx && s.admission_number === updates.admission_number)
  ) {
    throw new Error(`Admission Number "${updates.admission_number}" is already registered.`);
  }
  localList[idx] = { ...localList[idx], ...updates };
  writeLocalStudents(localList);
  return localList[idx];
}

/**
 * Remove a student from a teacher's roster.
 * Enforces teacher ownership verification against `teacherId`. If enrolled across other classrooms,
 * unlinks from this teacher's classroom without destroying other teachers' records.
 */
async function deleteStudentProfile(studentId, teacherId) {
  if (!studentId) {
    const err = new Error('Student ID is required');
    err.statusCode = 400;
    throw err;
  }
  if (!teacherId) {
    const err = new Error('Forbidden: Teacher scope is required to remove students.');
    err.statusCode = 403;
    throw err;
  }

  const sb = getSupabaseClient();
  ensureDurableOrDev(sb);

  const student = await findStudentRow(sb, studentId);
  if (!student) {
    const err = new Error('Student record not found');
    err.statusCode = 404;
    throw err;
  }

  const enrolled = await isStudentEnrolledWithTeacher(sb, student, teacherId);
  if (!enrolled) {
    const err = new Error('Forbidden: You do not have permission to remove this student.');
    err.statusCode = 403;
    throw err;
  }

  if (sb) {
    await sb
      .from('teacher_students')
      .delete()
      .eq('teacher_id', teacherId)
      .eq('student_id', student.id);

    if (student.teacher_id === teacherId) {
      const { data: otherEnrollments } = await sb
        .from('teacher_students')
        .select('id')
        .eq('student_id', student.id)
        .limit(1);

      if (Array.isArray(otherEnrollments) && otherEnrollments.length > 0) {
        await sb
          .from('students')
          .update({ teacher_id: null, updated_at: new Date().toISOString() })
          .eq('id', student.id);
        return { deleted: true, unlinkedOnly: true, id: student.id };
      }

      const { error } = await sb.from('students').delete().eq('id', student.id);
      if (error) throw new Error(`Failed to remove student: ${error.message}`);
      return { deleted: true, id: student.id };
    }

    return { deleted: true, unlinkedOnly: true, id: student.id };
  }

  const junctionLocal = readTeacherStudentsLocal().filter(
    r => !(r.teacher_id === teacherId && r.student_id === student.id)
  );
  writeTeacherStudentsLocal(junctionLocal);

  if (student.teacher_id && student.teacher_id !== teacherId) {
    return { deleted: true, unlinkedOnly: true, id: student.id };
  }

  const hasOtherEnrollments = junctionLocal.some(r => r.student_id === student.id);
  const localList = readLocalStudents();
  if (hasOtherEnrollments) {
    const updated = localList.map(s => (s.id === student.id ? { ...s, teacher_id: null } : s));
    writeLocalStudents(updated);
    return { deleted: true, unlinkedOnly: true, id: student.id };
  }

  const filtered = localList.filter(s => s.id !== student.id);
  writeLocalStudents(filtered);
  return { deleted: true, id: student.id };
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

  const sb = getSupabaseClient();
  ensureDurableOrDev(sb);

  const student = await findStudentRow(sb, studentId);
  if (!student) {
    const err = new Error('Student record not found.');
    err.statusCode = 404;
    throw err;
  }

  const cleanCode = String(teacherRefCode).trim().toUpperCase();
  let matchedTeacherId = null;

  if (activeCodeToTeacherMap.has(cleanCode)) {
    const cachedTeacherId = activeCodeToTeacherMap.get(cleanCode);
    if (matchesEntityRollingRefCode(cachedTeacherId, 'TCH', cleanCode)) {
      matchedTeacherId = cachedTeacherId;
    } else {
      activeCodeToTeacherMap.delete(cleanCode);
    }
  }

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

  if (!matchedTeacherId && isDemoOrFallbackAllowed()) {
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

  return await enrollStudentInClassroom({
    teacherId: matchedTeacherId,
    studentId: student.id,
    source: 'teacher_ref_code'
  });
}

/**
 * Adds an existing student to a teacher's roster via exact Roll Number (`DLP-26-XXXXX`)
 * or 5-minute Student Reference Code (`STU-XXXXXX`).
 * Disallows partial/fuzzy full-name or substring scans across tenants.
 */
async function teacherAddExistingStudent({ teacherId, admissionNumber, studentRefCode }) {
  if (!teacherId) {
    const err = new Error('Forbidden: Teacher authentication is required.');
    err.statusCode = 403;
    throw err;
  }

  const rawAdm = admissionNumber ? String(admissionNumber).trim() : '';
  const rawCode = studentRefCode ? String(studentRefCode).trim() : '';

  if (!rawAdm && !rawCode) {
    throw new Error('Please enter an exact Roll Number (DLP-26-XXXXX) or a 5-Minute Student Ref Code (STU-XXXXXX).');
  }

  const cleanAdm = rawAdm.toUpperCase();
  const cleanCode = rawCode.toUpperCase();
  const sb = getSupabaseClient();
  ensureDurableOrDev(sb);

  let targetStudent = null;

  // 1. Try 5-min rolling student reference code (`STU-XXXXXX`)
  const targetCode = cleanCode.startsWith('STU-')
    ? cleanCode
    : cleanAdm.startsWith('STU-')
    ? cleanAdm
    : cleanCode;

  if (targetCode) {
    if (sb) {
      const { data: studentIds, error } = await sb.from('students').select('id');
      if (!error && Array.isArray(studentIds)) {
        const matchedRow = studentIds.find(row =>
          matchesEntityRollingRefCode(row.id, 'STU', targetCode)
        );
        if (matchedRow?.id) {
          targetStudent = await findStudentRow(sb, matchedRow.id);
        }
      }
    } else {
      const localList = readLocalStudents();
      targetStudent =
        localList.find(s => matchesEntityRollingRefCode(s.id, 'STU', targetCode)) || null;
    }
  }

  // 2. Try exact Roll Number / Admission Number lookup (never substring/partial or fuzzy name scan)
  if (!targetStudent && cleanAdm && !cleanAdm.startsWith('STU-')) {
    if (sb) {
      const { data: byAdm, error: admErr } = await sb
        .from('students')
        .select('id, admission_number, full_name, dob, teacher_id, created_at')
        .eq('admission_number', cleanAdm)
        .maybeSingle();
      if (admErr) {
        throw new Error(`Database error looking up roll number: ${admErr.message}`);
      }
      targetStudent = byAdm || null;
    } else {
      const localList = readLocalStudents();
      targetStudent =
        localList.find(s => {
          const sAdm = (s.admission_number || s.admissionNumber || '').toUpperCase();
          return sAdm === cleanAdm;
        }) || null;
    }
  }

  if (!targetStudent) {
    throw new Error(
      `No student found matching "${rawAdm || rawCode}". Ask the student for their exact Roll Number or 5-Minute Ref Code.`
    );
  }

  // Multi-tenant enrollment into teacher_students
  await enrollStudentInClassroom({
    teacherId,
    studentId: targetStudent.id,
    source: 'manual_lookup',
  });

  return { success: true, student: targetStudent };
}

module.exports = {
  getJwtSecret,
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
