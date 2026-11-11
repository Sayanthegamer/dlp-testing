const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function isProductionEnv() {
  if (process.env.ALLOW_DEMO_AUTH === 'true') return false;
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL_ENV === 'production'
  );
}

function getFilePath(filename) {
  if (isProductionEnv()) {
    throw new Error(
      `[Durable Storage Required]: Local JSON fallback (${filename}) is disabled in production. Configure SUPABASE_URL and SUPABASE_SECRET_KEY.`
    );
  }
  const baseDir =
    process.env.LOCAL_DATA_DIR && process.env.LOCAL_DATA_DIR.trim()
      ? path.resolve(process.env.LOCAL_DATA_DIR.trim())
      : path.join(__dirname, '..', 'data');
  return path.join(baseDir, filename);
}

function ensureDataFile(filename, defaultData = []) {
  const filePath = getFilePath(filename);
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
  }
  return filePath;
}

function readLocalCollection(filename) {
  const filePath = ensureDataFile(filename, []);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) || [];
}

function writeLocalCollection(filename, data) {
  const filePath = ensureDataFile(filename, []);
  const serialized = JSON.stringify(data, null, 2);
  const randSuffix = crypto.randomBytes(4).toString('hex');
  const tmpFile = `${filePath}.${process.pid}.${Date.now()}.${randSuffix}.tmp`;
  try {
    fs.writeFileSync(tmpFile, serialized, 'utf8');
    try {
      fs.renameSync(tmpFile, filePath);
    } catch (renameErr) {
      if (renameErr && (renameErr.code === 'EPERM' || renameErr.code === 'EBUSY')) {
        fs.writeFileSync(filePath, serialized, 'utf8');
        try {
          if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        } catch (_) {}
      } else {
        throw renameErr;
      }
    }
    return true;
  } catch (err) {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch (_) {}
    console.error(`[Local Store Write Error (${filename})]:`, err.message);
    return false;
  }
}

const readExamsLocal = () => readLocalCollection('exams.json');
const writeExamsLocal = (data) => writeLocalCollection('exams.json', data);

const readSubmissionsLocal = () => readLocalCollection('submissions.json');
const writeSubmissionsLocal = (data) => writeLocalCollection('submissions.json', data);

const readLocalStudents = () => readLocalCollection('students.json');
const writeLocalStudents = (data) => writeLocalCollection('students.json', data);

const readTeacherStudentsLocal = () => readLocalCollection('teacher_students.json');
const writeTeacherStudentsLocal = (data) => writeLocalCollection('teacher_students.json', data);

function enrollTeacherStudentLocal({
  teacherId,
  studentId,
  classCode = null,
  enrollmentSource = 'class_code',
}) {
  if (!teacherId || !studentId) return null;
  const list = readTeacherStudentsLocal();
  const existing = list.find((r) => r.teacher_id === teacherId && r.student_id === studentId);
  if (existing) {
    existing.class_code = classCode || existing.class_code;
    existing.enrollment_source = enrollmentSource || existing.enrollment_source;
    writeTeacherStudentsLocal(list);
    return existing;
  }
  const newRecord = {
    id: `ts_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    teacher_id: teacherId,
    student_id: studentId,
    class_code: classCode,
    enrollment_source: enrollmentSource,
    enrolled_at: new Date().toISOString(),
  };
  list.push(newRecord);
  writeTeacherStudentsLocal(list);
  return newRecord;
}

module.exports = {
  isProductionEnv,
  getFilePath,
  readLocalCollection,
  writeLocalCollection,
  readExamsLocal,
  writeExamsLocal,
  readSubmissionsLocal,
  writeSubmissionsLocal,
  readLocalStudents,
  writeLocalStudents,
  readTeacherStudentsLocal,
  writeTeacherStudentsLocal,
  enrollTeacherStudentLocal,
};
