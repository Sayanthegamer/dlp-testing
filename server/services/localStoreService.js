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

module.exports = {
  readLocalCollection,
  writeLocalCollection,
  readExamsLocal,
  writeExamsLocal,
  readSubmissionsLocal,
  writeSubmissionsLocal,
  readLocalStudents,
  writeLocalStudents
};
