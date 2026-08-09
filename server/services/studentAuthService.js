const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { supabase, isConfigured } = require('./supabaseClient');

const JWT_SECRET = process.env.JWT_SECRET || 'antigravity_dlp_secret_key_2026';
const LOCAL_STUDENTS_FILE = path.join(__dirname, '../data/students.json');

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
    JWT_SECRET,
    { expiresIn: '30d' }
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

function generateAdmissionNumber(prefix = 'ADM') {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}${rand}`;
}

/**
 * Register a new student profile with Admission Number, Full Name, & DOB
 */
async function studentSignup({ admissionNumber, fullName, dob, teacherId }) {
  if (!fullName || !dob) {
    throw new Error('Full Name and Date of Birth are required');
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
    teacher_id: teacherId || null,
    created_at: new Date().toISOString()
  };

  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('students')
      .insert([newStudent])
      .select()
      .single();

    if (!error && data) {
      const token = generateStudentToken(data);
      return { student: data, token };
    }
    if (error && error.code === '23505') {
      throw new Error(`Admission Number "${cleanAdm}" is already registered. Please log in.`);
    }
  }

  // Local JSON fallback
  const localList = readLocalStudents();
  const existing = localList.find(s => s.admission_number.toUpperCase() === cleanAdm);
  if (existing) {
    throw new Error(`Admission Number "${cleanAdm}" is already registered. Please log in.`);
  }

  localList.push(newStudent);
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
    const { data, error } = await supabase
      .from('submissions')
      .select('*, exams(title, subject, grade)')
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map(sub => ({
        ...sub,
        examTitle: sub.exams ? sub.exams.title : 'Exam',
        examSubject: sub.exams ? sub.exams.subject : 'General',
        examGrade: sub.exams ? sub.exams.grade : 'JEE'
      }));
    }
  }

  // Local JSON fallback
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
  const supabase = getSupabaseClient();
  if (supabase && teacherId) {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (err) {}
  }

  const localList = readLocalStudents();
  return localList.filter(s => !teacherId || s.teacher_id === teacherId);
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
