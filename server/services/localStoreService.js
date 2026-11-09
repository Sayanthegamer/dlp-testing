const fs = require('fs');
const path = require('path');

function isServerlessEnv() {
  return process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV) || process.env.NODE_ENV === 'production';
}

function getFilePath(filename) {
  if (isServerlessEnv()) {
    return path.join('/tmp', filename);
  }
  return path.join(__dirname, '..', 'data', filename);
}

function ensureDataFile(filename, defaultData = []) {
  const filePath = getFilePath(filename);
  const dirPath = path.dirname(filePath);
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
    }
    return filePath;
  } catch (err) {
    const tmpPath = path.join('/tmp', filename);
    try {
      if (!fs.existsSync(tmpPath)) {
        fs.writeFileSync(tmpPath, JSON.stringify(defaultData, null, 2), 'utf8');
      }
    } catch (_) {}
    return tmpPath;
  }
}

function readLocalCollection(filename) {
  const filePath = ensureDataFile(filename, []);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) || [];
  } catch (_) {
    try {
      const rawTmp = fs.readFileSync(path.join('/tmp', filename), 'utf8');
      return JSON.parse(rawTmp) || [];
    } catch (__) {
      return [];
    }
  }
}

function writeLocalCollection(filename, data) {
  const filePath = ensureDataFile(filename, []);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (_) {
    try {
      fs.writeFileSync(path.join('/tmp', filename), JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (__) {
      return false;
    }
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

function enrollTeacherStudentLocal({ teacherId, studentId, classCode = null, enrollmentSource = 'class_code' }) {
  if (!teacherId || !studentId) return null;
  const list = readTeacherStudentsLocal();
  const existing = list.find(r => r.teacher_id === teacherId && r.student_id === studentId);
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
    enrolled_at: new Date().toISOString()
  };
  list.push(newRecord);
  writeTeacherStudentsLocal(list);
  return newRecord;
}

module.exports = {
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
  enrollTeacherStudentLocal
};
