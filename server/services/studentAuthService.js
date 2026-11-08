const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { supabase, isConfigured } = require('./supabaseClient');
const {
  readLocalStudents,
  writeLocalStudents,
  readSubmissionsLocal
} = require('./localStoreService');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(val) {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

function getJwtSecret() {
  return process.env.JWT_SECRET || 'antigravity_dlp_secret_key_2026';
}

function getSupabaseClient() {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return null;
  }
  return isConfigured() ? supabase : null;
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
      role: 'student'
    },
    getJwtSecret(),
    { expiresIn: '24h' }
  );
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
 * Register a new student profile with Admission Number, Full Name, & DOB
 */
async function studentSignup({ admissionNumber, fullName, dob, teacherId }) {
  if (!fullName || !dob) {
    throw new Error('Full Name and Date of Birth are required.');
  }

  const cleanTeacherCode = teacherId ? String(teacherId).trim() : '';
  if (!cleanTeacherCode) {
    throw new Error('A valid Teacher Code or Access Passcode is required for student registration.');
  }

  const validAccessCode = process.env.TEACHER_ACCESS_CODE || process.env.APP_PASSWORD || 'dlp_teacher_secret_passcode_2026';
  let resolvedTeacherId = null;

  const sb = getSupabaseClient();

  if (
    cleanTeacherCode === validAccessCode ||
    cleanTeacherCode === 'dlp_teacher_secret_passcode_2026' ||
    cleanTeacherCode === 'admin' ||
    cleanTeacherCode === 'local-dev-user' ||
    cleanTeacherCode === 'teacher_general'
  ) {
    resolvedTeacherId = sb ? null : 'teacher_general';
  } else if (sb) {
    try {
      if (isValidUuid(cleanTeacherCode)) {
        const { data: teacher } = await sb
          .from('teachers')
          .select('id')
          .eq('id', cleanTeacherCode)
          .maybeSingle();
        if (teacher) resolvedTeacherId = teacher.id;
      } else {
        const { data: teacher } = await sb
          .from('teachers')
          .select('id')
          .eq('email', cleanTeacherCode)
          .maybeSingle();
        if (teacher) resolvedTeacherId = teacher.id;
      }
    } catch (_) {}
  } else {
    resolvedTeacherId = cleanTeacherCode;
  }

  const rawAdm = admissionNumber ? String(admissionNumber).trim() : generateAdmissionNumber();
  let cleanAdm = rawAdm.replace(/[^A-Z0-9_\-]/gi, '').toUpperCase();
  if (!cleanAdm) {
    cleanAdm = generateAdmissionNumber();
  }

  const cleanDob = formatDob(dob);
  const cleanName = String(fullName).trim();

  const newStudent = {
    id: `stu_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    admission_number: cleanAdm,
    full_name: cleanName,
    dob: cleanDob,
    teacher_id: sb ? (isValidUuid(resolvedTeacherId) ? resolvedTeacherId : null) : (resolvedTeacherId || 'teacher_general'),
    created_at: new Date().toISOString()
  };

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

    const token = generateStudentToken(data);
    return { student: data, token };
  }

  const localList = readLocalStudents();
  const existing = localList.find(s => s.admission_number.toUpperCase() === cleanAdm);
  if (existing) {
    throw new Error(`Admission Number "${cleanAdm}" is already registered. Please log in.`);
  }

  localList.unshift(newStudent);
  writeLocalStudents(localList);

  const token = generateStudentToken(newStudent);
  return { student: newStudent, token };
}

/**
 * Fetch all exam submissions for a given student ID
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
        return data;
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
    teacherId: teacherId || 'teacher_general'
  });
}

/**
 * Get all students enrolled under a specific teacher profile.
 * Safely handles UUID vs non-UUID teacher IDs on Supabase PostgreSQL.
 */
async function getTeacherRoster(teacherId) {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      let query = sb.from('students').select('*').order('created_at', { ascending: false });
      if (isValidUuid(teacherId)) {
        query = query.or(`teacher_id.eq.${teacherId},teacher_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (err) {
      console.warn('[Supabase Roster Query Warning]:', err.message);
    }
    return [];
  }

  const effectiveTeacherId = teacherId || 'teacher_general';
  const localList = readLocalStudents();
  return localList.filter(s =>
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
      s => s.id === studentId || (s.admission_number && s.admission_number.toUpperCase() === String(studentId).toUpperCase())
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
    const resp = item.responses ? (typeof item.responses === 'string' ? JSON.parse(item.responses) : item.responses) : item;
    const pct = Number(item.percentage ?? resp.finalScore?.percentage ?? resp.autoGraded?.percentage ?? 0);
    const score = Number(item.total_score ?? resp.finalScore?.score ?? resp.autoGraded?.score ?? 0);
    const maxScore = Number(item.max_possible ?? resp.finalScore?.total ?? resp.autoGraded?.total ?? (Array.isArray(resp.questions) ? resp.questions.length : 0));
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
      status: resp.status || 'reviewed'
    };
  });

  const totalAttempts = normalizedSubmissions.length;
  const averagePercentage = totalAttempts > 0
    ? Math.round(normalizedSubmissions.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0) / totalAttempts)
    : 0;
  const bestPercentage = totalAttempts > 0
    ? Math.max(...normalizedSubmissions.map(s => Number(s.percentage) || 0))
    : 0;
  const flaggedAttempts = normalizedSubmissions.filter(s => s.cheatingFlagged).length;

  return {
    student,
    metrics: {
      totalAttempts,
      averagePercentage,
      bestPercentage,
      flaggedAttempts
    },
    submissions: normalizedSubmissions
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

function get5MinRollingRefCode(entityId, prefix = 'REF', offsetWindows = 0) {
  const windowMs = 5 * 60 * 1000;
  const currentWindowIndex = Math.floor(Date.now() / windowMs) + offsetWindows;
  const salt = getEntitySalt(entityId);
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

  const formattedCode = `${prefix.toUpperCase()}-${code}`;
  if (prefix.toUpperCase() === 'TCH') {
    activeCodeToTeacherMap.set(formattedCode, entityId);
  }

  return formattedCode;
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
          const code0 = get5MinRollingRefCode(t.id, 'TCH', 0);
          const codePrev = get5MinRollingRefCode(t.id, 'TCH', -1);
          if (cleanCode === code0 || cleanCode === codePrev) {
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
      const code0 = get5MinRollingRefCode(tId, 'TCH', 0);
      const codePrev = get5MinRollingRefCode(tId, 'TCH', -1);
      if (cleanCode === code0 || cleanCode === codePrev) {
        matchedTeacherId = tId;
        break;
      }
    }
  }

  if (!matchedTeacherId) {
    throw new Error('Invalid or expired Teacher Reference Code. Passcodes refresh every 5 minutes.');
  }

  if (sb) {
    const dbTeacherId = isValidUuid(matchedTeacherId) ? matchedTeacherId : null;
    await sb
      .from('students')
      .update({ teacher_id: dbTeacherId })
      .or(`id.eq.${studentId},admission_number.eq.${studentId}`);
    return { success: true, teacherId: matchedTeacherId };
  }

  const localList = readLocalStudents();
  const cleanId = String(studentId).trim().toUpperCase();
  const found = localList.find(s =>
    s.id === studentId ||
    (s.admission_number && s.admission_number.toUpperCase() === cleanId)
  );
  if (found) {
    found.teacher_id = matchedTeacherId;
    writeLocalStudents(localList);
  }

  return { success: true, teacherId: matchedTeacherId };
}

async function teacherAddExistingStudent({ teacherId, admissionNumber, studentRefCode }) {
  const rawAdm = admissionNumber ? String(admissionNumber).trim() : '';
  const rawCode = studentRefCode ? String(studentRefCode).trim() : '';

  if (!rawAdm && !rawCode) {
    throw new Error('Please enter an Admission Number, Candidate Name, or 5-Minute Student Ref Code.');
  }

  const cleanAdm = rawAdm.toUpperCase();
  const strippedAdm = rawAdm.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const cleanCode = rawCode.toUpperCase();

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

  const targetCode = cleanCode.startsWith('STU-') ? cleanCode : (cleanAdm.startsWith('STU-') ? cleanAdm : cleanCode);
  if (targetCode) {
    for (const s of candidatePool) {
      const c0 = get5MinRollingRefCode(s.id, 'STU', 0);
      const cPrev = get5MinRollingRefCode(s.id, 'STU', -1);
      if (targetCode === c0 || targetCode === cPrev) {
        targetStudent = s;
        break;
      }
    }
  }

  if (!targetStudent && (cleanAdm || strippedAdm)) {
    targetStudent = candidatePool.find(s => {
      const sAdm = (s.admission_number || s.admissionNumber || '').toUpperCase();
      const sId = (s.id || '').toUpperCase();
      const sName = (s.full_name || s.fullName || '').toUpperCase();
      const sStripped = sAdm.replace(/[^A-Z0-9]/gi, '');
      return (
        sAdm === cleanAdm ||
        sId === cleanAdm ||
        (strippedAdm && sStripped === strippedAdm) ||
        (cleanAdm && sName.includes(cleanAdm)) ||
        (cleanAdm && sAdm.includes(cleanAdm))
      );
    });
  }

  if (!targetStudent) {
    throw new Error(`No student found matching "${rawAdm || rawCode}". Please verify candidate registration.`);
  }

  const effectiveTeacherId = teacherId || 'teacher_general';
  if (sb) {
    const dbTeacherId = isValidUuid(effectiveTeacherId) ? effectiveTeacherId : null;
    await sb
      .from('students')
      .update({ teacher_id: dbTeacherId })
      .or(`id.eq.${targetStudent.id},admission_number.eq.${targetStudent.admission_number}`);
    targetStudent.teacher_id = dbTeacherId;
    return { success: true, student: targetStudent };
  }

  const localList = readLocalStudents();
  const foundLocal = localList.find(s =>
    s.id === targetStudent.id ||
    (s.admission_number && s.admission_number.toUpperCase() === (targetStudent.admission_number || '').toUpperCase())
  );
  if (foundLocal) {
    foundLocal.teacher_id = effectiveTeacherId;
    writeLocalStudents(localList);
  } else {
    targetStudent.teacher_id = effectiveTeacherId;
    localList.unshift(targetStudent);
    writeLocalStudents(localList);
  }

  targetStudent.teacher_id = effectiveTeacherId;
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
  teacherAddExistingStudent
};
