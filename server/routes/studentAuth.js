const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { verifyTeacherAuth, isDemoOrFallbackAllowed } = require('../services/authService');
const {
  getJwtSecret,
  studentLogin,
  studentSignup,
  getStudentSubmissions,
  teacherCreateStudent,
  getTeacherRoster,
  getStudentDossier,
  updateStudentProfile,
  deleteStudentProfile,
  get5MinRollingRefCode,
  getRefCodeSecondsLeft,
  regenerateEntitySalt,
  studentLinkToTeacher,
  teacherAddExistingStudent,
  computeTeacherClassCode,
  studentJoinClass,
} = require('../services/studentAuthService');

// Middleware to verify student token
function authenticateStudentToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Student authentication token required' });
  }

  let secret;
  try {
    secret = getJwtSecret();
  } catch (err) {
    return res.status(err.statusCode || 503).json({
      success: false,
      error: err.message || 'Server configuration error: JWT_SECRET is not set.',
    });
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err || !decoded || decoded.role !== 'student' || !decoded.studentId) {
      return res.status(403).json({ success: false, error: 'Invalid or expired student session' });
    }
    req.student = decoded;
    next();
  });
}

function getAuthenticatedTeacherScope(req) {
  if (req.user?.id) {
    return req.user.id;
  }
  if (isDemoOrFallbackAllowed()) {
    return req.user?.localId || 'local-dev-user';
  }
  return null;
}

async function handleStudentLogin(req, res) {
  try {
    const { admissionNumber, dob } = req.body || {};
    const result = await studentLogin({ admissionNumber, dob });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
}

async function handleStudentSignup(req, res) {
  try {
    const { admissionNumber, fullName, dob, teacherCode, classCode, hp_confirm, website, renderedAt } = req.body || {};

    // 1. Invisible Bot Honeypot Trap: Automated bots populate hidden form fields
    if (hp_confirm || website) {
      return res.status(400).json({ success: false, error: 'Registration request flagged as automated spam.' });
    }

    // 2. Automated Rapid-Fire Trap: Submitting registration within < 800ms of form render indicates automated script
    if (renderedAt && typeof renderedAt === 'number') {
      const elapsedMs = Date.now() - renderedAt;
      if (elapsedMs < 800) {
        return res.status(400).json({ success: false, error: 'Submission rejected: completed suspiciously fast.' });
      }
    }

    const result = await studentSignup({
      admissionNumber,
      fullName,
      dob,
      classCode: classCode || teacherCode,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
}

async function handleStudentJoinClass(req, res) {
  try {
    const studentId = req.student?.studentId;
    const { classCode } = req.body || {};
    if (!studentId) {
      return res.status(401).json({ success: false, error: 'Authenticated student session required' });
    }
    if (!classCode) {
      return res.status(400).json({ success: false, error: 'Class Code is required' });
    }
    const result = await studentJoinClass({ studentId, classCode });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
}

// POST /api/student/login (and alias /api/student-auth/login) - Student Login (Admission Number + DOB)
router.post('/student/login', handleStudentLogin);
router.post('/student-auth/login', handleStudentLogin);

// POST /api/student/signup (and alias /api/student-auth/signup) - Student Self-Registration
router.post('/student/signup', handleStudentSignup);
router.post('/student-auth/signup', handleStudentSignup);

// POST /api/student/join-class (and alias /api/student-auth/join-class) - Join a classroom via CLASS-XXXXXX code
router.post('/student/join-class', authenticateStudentToken, handleStudentJoinClass);
router.post('/student-auth/join-class', authenticateStudentToken, handleStudentJoinClass);

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
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
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
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
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
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// POST /api/student/link-teacher - Student links to Teacher via Teacher Ref Code
router.post('/student/link-teacher', authenticateStudentToken, async (req, res) => {
  try {
    const studentId = req.student.studentId;
    const { teacherRefCode } = req.body || {};
    const result = await studentLinkToTeacher({ studentId, teacherRefCode });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

// GET /api/teacher/class-code - Permanent Classroom Code & Shareable Invite Link
router.get('/teacher/class-code', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  const teacherId = getAuthenticatedTeacherScope(req);
  if (!teacherId) {
    return res.status(403).json({ success: false, error: 'Valid teacher account required.' });
  }
  try {
    const classCode = computeTeacherClassCode(teacherId);
    const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost:5173')
      .split(',')[0]
      .trim();
    const protocol = (req.get('x-forwarded-proto') || req.protocol || 'http')
      .split(',')[0]
      .trim();
    const inviteLink = `${protocol}://${host}/?mode=student&tab=signup&classCode=${classCode}`;
    return res.json({ success: true, classCode, inviteLink });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// GET /api/teacher/rolling-ref-code - Teacher's 5-Min Rolling Link Code
router.get('/teacher/rolling-ref-code', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  const teacherId = getAuthenticatedTeacherScope(req);
  if (!teacherId) {
    return res.status(403).json({ success: false, error: 'Valid teacher account required.' });
  }
  try {
    const refCode = get5MinRollingRefCode(teacherId, 'TCH', 0);
    const expiresInSeconds = getRefCodeSecondsLeft();
    return res.json({ success: true, refCode, expiresInSeconds });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// POST /api/teacher/rolling-ref-code/regenerate - Regenerate Teacher's Code
router.post('/teacher/rolling-ref-code/regenerate', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  const teacherId = getAuthenticatedTeacherScope(req);
  if (!teacherId) {
    return res.status(403).json({ success: false, error: 'Valid teacher account required.' });
  }
  try {
    regenerateEntitySalt(teacherId);
    const refCode = get5MinRollingRefCode(teacherId, 'TCH', 0);
    const expiresInSeconds = getRefCodeSecondsLeft();
    return res.json({ success: true, refCode, expiresInSeconds });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// POST /api/teacher/add-existing-student - Teacher claims/enrolls existing student via exact Roll No. or Ref Code
router.post('/teacher/add-existing-student', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  const teacherId = getAuthenticatedTeacherScope(req);
  if (!teacherId) {
    return res.status(403).json({ success: false, error: 'Valid teacher account required.' });
  }
  try {
    const { admissionNumber, studentRefCode } = req.body || {};
    const result = await teacherAddExistingStudent({ teacherId, admissionNumber, studentRefCode });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

// POST /api/teacher/students - Teacher enrolls a student
router.post('/teacher/students', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  const teacherId = getAuthenticatedTeacherScope(req);
  if (!teacherId) {
    return res.status(403).json({ success: false, error: 'Valid teacher account required.' });
  }
  try {
    const { admissionNumber, fullName, dob } = req.body || {};
    const result = await teacherCreateStudent({ teacherId, admissionNumber, fullName, dob });
    return res.json({ success: true, student: result.student });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

// GET /api/teacher/students - Teacher views enrolled student roster
router.get('/teacher/students', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  const teacherId = getAuthenticatedTeacherScope(req);
  if (!teacherId) {
    return res.status(403).json({ success: false, error: 'Valid teacher account required.' });
  }
  try {
    const roster = await getTeacherRoster(teacherId);
    return res.json({ success: true, data: roster });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// GET /api/teacher/students/:studentId/dossier - Candidate Dossier (profile, metrics, submissions)
router.get('/teacher/students/:studentId/dossier', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  const teacherId = getAuthenticatedTeacherScope(req);
  if (!teacherId) {
    return res.status(403).json({ success: false, error: 'Valid teacher account required.' });
  }
  try {
    const dossier = await getStudentDossier(req.params.studentId, teacherId);
    return res.json({ success: true, ...dossier });
  } catch (err) {
    return res.status(err.statusCode || 404).json({ success: false, error: err.message });
  }
});

// PATCH /api/teacher/students/:studentId - Update candidate details
router.patch('/teacher/students/:studentId', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  const teacherId = getAuthenticatedTeacherScope(req);
  if (!teacherId) {
    return res.status(403).json({ success: false, error: 'Valid teacher account required.' });
  }
  try {
    const updated = await updateStudentProfile(req.params.studentId, req.body || {}, teacherId);
    return res.json({ success: true, student: updated });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

// DELETE /api/teacher/students/:studentId - Remove candidate from roster
router.delete('/teacher/students/:studentId', async (req, res) => {
  if (!(await verifyTeacherAuth(req))) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Teacher credentials required' });
  }
  const teacherId = getAuthenticatedTeacherScope(req);
  if (!teacherId) {
    return res.status(403).json({ success: false, error: 'Valid teacher account required.' });
  }
  try {
    const result = await deleteStudentProfile(req.params.studentId, teacherId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }
});

module.exports = router;
