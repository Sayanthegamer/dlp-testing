const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { supabase, isConfigured } = require('./supabaseClient');

const LOCAL_STUDENTS_FILE = path.join(__dirname, '../data/students.json');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'antigravity_dlp_secret_key_2026';
}

function getSupabaseClient() {
  return isConfigured() ? supabase : null;
}

// Ensure local JSON storage directory & file exist for fallback
function ensureLocalStore() {
  const dir = path.dirname(LOCAL_STUDENTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_STUDENTS_FILE)) {
    fs.writeFileSync(LOCAL_STUDENTS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readLocalStudents() {
  try {
    ensureLocalStore();
    const data = fs.readFileSync(LOCAL_STUDENTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.warn('[Local Student Store Warning]:', err.message);
    return [];
  }
}

function writeLocalStudents(students) {
  try {
    ensureLocalStore();
    fs.writeFileSync(LOCAL_STUDENTS_FILE, JSON.stringify(students, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Local Student Store Error]:', err.message);
  }
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
 */
async function studentLogin({ admissionNumber, dob }) {
  if (!admissionNumber || !dob) {
    throw new Error('Admission Number and Date of Birth are required');
  }

  const cleanAdm = String(admissionNumber).trim().toUpperCase();
  const cleanDob = formatDob(dob);

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('admission_number', cleanAdm)
      .eq('dob', cleanDob)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase Student Login Warning]:', error.message);
    } else if (data) {
      const token = generateStudentToken(data);
      return { student: data, token };
    }
  }

  // Local JSON fallback check
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
    entropy += chars.charAt(Math.floor(Math.random() * chars.length));
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

  if (
    cleanTeacherCode === validAccessCode ||
    cleanTeacherCode === 'dlp_teacher_secret_passcode_2026' ||
    cleanTeacherCode === 'admin'
  ) {
    resolvedTeacherId = 'teacher_general';
  } else {
    // Check if cleanTeacherCode is a registered teacher ID or email in Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .or(`id.eq.${cleanTeacherCode},email.eq.${cleanTeacherCode}`)
        .maybeSingle();

      if (teacher) {
        resolvedTeacherId = teacher.id;
      }
    }
    if (!resolvedTeacherId) {
      resolvedTeacherId = cleanTeacherCode;
    }
  }

  const rawAdm = admissionNumber ? String(admissionNumber).trim() : generateAdmissionNumber();
  let cleanAdm = rawAdm.replace(/[^A-Z0-9_\-]/gi, '').toUpperCase();
  if (!cleanAdm) {
    cleanAdm = generateAdmissionNumber();
  }

  const cleanDob = formatDob(dob);
  const cleanName = String(fullName).trim();

  const newStudent = {
    id: `stu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    admission_number: cleanAdm,
    full_name: cleanName,
    dob: cleanDob,
    teacher_id: resolvedTeacherId,
    created_at: new Date().toISOString()
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('students')
      .insert([newStudent])
      .select()
      .single();

    if (error && error.code === '23505') {
      throw new Error(`Admission Number "${cleanAdm}" is already registered. Please log in.`);
    }

    if (!error && data) {
      // Sync to local JSON cache as well
      const localList = readLocalStudents();
      const existingIdx = localList.findIndex(s => s.admission_number.toUpperCase() === cleanAdm);
      if (existingIdx >= 0) {
        localList[existingIdx] = data;
      } else {
        localList.unshift(data);
      }
      writeLocalStudents(localList);

      const token = generateStudentToken(data);
      return { student: data, token };
    }
  }

  // Local JSON fallback
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

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*, exams(title, subject, grade)')
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (e) {}
  }

  try {
    const subsPath = path.join(__dirname, '../data/submissions.json');
    if (fs.existsSync(subsPath)) {
      const raw = fs.readFileSync(subsPath, 'utf-8');
      const allSubmissions = JSON.parse(raw);
      return allSubmissions.filter(s => s.student_id === studentId);
    }
  } catch (e) {
    console.warn('[Student Submissions Local Fallback Error]:', e.message);
  }

  return [];
}

/**
 * Teacher adds a student to their roster
 */
async function teacherCreateStudent({ teacherId, admissionNumber, fullName, dob }) {
  return await studentSignup({ admissionNumber, fullName, dob, teacherId });
}

/**
 * Get all students enrolled under a teacher profile
 */
async function getTeacherRoster(teacherId) {
  let supabaseStudents = [];
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      let query = supabase.from('students').select('*').order('created_at', { ascending: false });
      if (teacherId && teacherId !== 'null' && teacherId !== 'undefined' && teacherId !== 'local-dev-user') {
        query = query.or(`teacher_id.eq.${teacherId},teacher_id.is.null,teacher_id.eq.teacher_general,teacher_id.eq.00000000-0000-0000-0000-000000000001`);
      }
      const { data, error } = await query;

      if (!error && Array.isArray(data)) {
        supabaseStudents = data;
      }
    } catch (err) {}
  }

  const localList = readLocalStudents();
  const filteredLocal = localList.filter(s =>
    !teacherId ||
    teacherId === 'null' ||
    teacherId === 'undefined' ||
    teacherId === 'local-dev-user' ||
    !s.teacher_id ||
    s.teacher_id === 'null' ||
    s.teacher_id === 'teacher_general' ||
    s.teacher_id === teacherId ||
    s.teacher_id === '00000000-0000-0000-0000-000000000001'
  );

  // Merge Supabase & Local rosters seamlessly
  const map = new Map();
  for (const s of [...supabaseStudents, ...filteredLocal]) {
    const key = (s.admission_number || s.id).toUpperCase();
    if (!map.has(key)) {
      map.set(key, s);
    }
  }

  return Array.from(map.values());
}

module.exports = {
  studentLogin,
  studentSignup,
  getStudentSubmissions,
  teacherCreateStudent,
  getTeacherRoster,
  formatDob,
  generateAdmissionNumber
};
