const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { verifyTeacherAuth } = require('../services/authService');
const {
  studentLogin,
  studentSignup,
  getStudentSubmissions,
  teacherCreateStudent,
  getTeacherRoster,
  get5MinRollingRefCode,
  getRefCodeSecondsLeft,
  regenerateEntitySalt,
  studentLinkToTeacher,
  teacherAddExistingStudent
} = require('../services/studentAuthService');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn('[SECURITY WARNING] JWT_SECRET environment variable is missing! Using fallback secret.');
    return 'antigravity_dlp_secret_key_2026';
  }
  return secret;
}

// Middleware to verify student token
function authenticateStudentToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Student authentication token required' });
  }

  jwt.verify(token, getJwtSecret(), (err, decoded) => {
    if (err || !decoded || decoded.role !== 'student') {
      return res.status(403).json({ success: false, error: 'Invalid or expired student session' });
    }
    req.student = decoded;
    next();
  });
}

// POST /api/student/login - Student Login (Admission Number + DOB)
router.post('/student/login', async (req, res) => {
  try {
    const { admissionNumber, dob } = req.body;
    const result = await studentLogin({ admissionNumber, dob });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/student/signup - Student Self-Registration
router.post('/student/signup', async (req, res) => {
  try {
    const { admissionNumber, fullName, dob, teacherCode } = req.body;
    const result = await studentSignup({ admissionNumber, fullName, dob, teacherId: teacherCode });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/student/me - Current Student Profile
router.get('/student/me', authenticateStudentToken, async (req, res) => {
  return res.json({
    success: true,
    student: {
      id: req.student.studentId,
      admissionNumber: req.student.admissionNumber,
      fullName: req.student.fullName
    }
  });
});

// GET /api/student/submissions - Authenticated Student Test History
router.get('/student/submissions', authenticateStudentToken, async (req, res) => {
  try {
    const submissions = await getStudentSubmissions(req.student.studentId);
    return res.json({ success: true, data: submissions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/student/rolling-ref-code - Student's 5-Min Rolling Ref Code
router.get('/student/rolling-ref-code', authenticateStudentToken, async (req, res) => {
  try {
    const studentId = req.student.studentId;
    const refCode = get5MinRollingRefCode(studentId, 'STU', 0);
    const expiresInSeconds = getRefCodeSecondsLeft();
    return res.json({ success: true, refCode, expiresInSeconds });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/student/rolling-ref-code/regenerate - Regenerate Student's Code
router.post('/student/rolling-ref-code/regenerate', authenticateStudentToken, async (req, res) => {
  try {
    const studentId = req.student.studentId;
    regenerateEntitySalt(studentId);
    const refCode = get5MinRollingRefCode(studentId, 'STU', 0);
    const expiresInSeconds = getRefCodeSecondsLeft();
    return res.json({ success: true, refCode, expiresInSeconds });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/student/link-teacher - Student links to Teacher via Teacher Ref Code
router.post('/student/link-teacher', authenticateStudentToken, async (req, res) => {
  try {
    const studentId = req.student.studentId;
    const { teacherRefCode } = req.body;
    const result = await studentLinkToTeacher({ studentId, teacherRefCode });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/teacher/rolling-ref-code - Teacher's 5-Min Rolling Link Code
router.get('/teacher/rolling-ref-code', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  try {
    const teacherId = req.user?.id || 'teacher_general';
    const refCode = get5MinRollingRefCode(teacherId, 'TCH', 0);
    const expiresInSeconds = getRefCodeSecondsLeft();
    return res.json({ success: true, refCode, expiresInSeconds });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/teacher/rolling-ref-code/regenerate - Regenerate Teacher's Code
router.post('/teacher/rolling-ref-code/regenerate', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  try {
    const teacherId = req.user?.id || 'teacher_general';
    regenerateEntitySalt(teacherId);
    const refCode = get5MinRollingRefCode(teacherId, 'TCH', 0);
    const expiresInSeconds = getRefCodeSecondsLeft();
    return res.json({ success: true, refCode, expiresInSeconds });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/teacher/add-existing-student - Teacher claims existing student via Admission No + Student Ref Code
router.post('/teacher/add-existing-student', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  try {
    const teacherId = req.user?.id || 'teacher_general';
    const { admissionNumber, studentRefCode } = req.body;
    const result = await teacherAddExistingStudent({ teacherId, admissionNumber, studentRefCode });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/teacher/students - Teacher enrolls a student
router.post('/teacher/students', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  try {
    const { teacherId, admissionNumber, fullName, dob } = req.body;
    const effectiveTeacherId = req.user?.id || teacherId;
    const result = await teacherCreateStudent({ teacherId: effectiveTeacherId, admissionNumber, fullName, dob });
    return res.json({ success: true, student: result.student });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/teacher/students - Teacher views enrolled student roster
router.get('/teacher/students', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  try {
    const teacherId = req.user?.id || req.query.teacherId || 'teacher_general';
    const roster = await getTeacherRoster(teacherId);
    return res.json({ success: true, data: roster });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
