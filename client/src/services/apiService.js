/**
 * Client API Service to interface with Express backend proxy.
 * The backend securely attaches ANTHROPIC_API_KEY server-side.
 */

function getAuthHeader() {
  const token = localStorage.getItem('teacher_auth_token') || 'dev-fallback-token';
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns true if refresh succeeded, false otherwise.
 */
async function refreshAuthToken() {
  const refreshToken = localStorage.getItem('teacher_refresh_token');
  if (!refreshToken) return false;

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!response.ok) {
      // Refresh failed — clear stale tokens
      localStorage.removeItem('teacher_auth_token');
      localStorage.removeItem('teacher_refresh_token');
      return false;
    }

    const data = await response.json();
    if (data.token) {
      localStorage.setItem('teacher_auth_token', data.token);
    }
    if (data.refresh_token) {
      localStorage.setItem('teacher_refresh_token', data.refresh_token);
    }
    return true;
  } catch (err) {
    console.warn('[Token Refresh Error]:', err.message);
    return false;
  }
}

/**
 * Wrapper around fetch that auto-retries once on 401 by refreshing the token.
 * Use this for all authenticated API calls.
 */
async function authenticatedFetch(url, options = {}) {
  // First attempt with current token
  options.headers = { ...options.headers, ...getAuthHeader() };
  let response = await fetch(url, options);

  // If 401, try refreshing the token and retry once
  if (response.status === 401) {
    const refreshed = await refreshAuthToken();
    if (refreshed) {
      options.headers = { ...options.headers, ...getAuthHeader() };
      response = await fetch(url, options);
    }
  }

  return response;
}

export async function loginTeacher(email, password) {
  let response;
  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
  } catch (networkErr) {
    throw new Error('Network error: Cannot reach the server. Please check your connection.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    let errorMsg = data.error || 'Login failed.';
    if (typeof errorMsg === 'object' || errorMsg === '{}' || errorMsg === '[object Object]') {
      errorMsg = 'Login failed. Please check your credentials.';
    }
    throw new Error(errorMsg);
  }

  if (data.token) {
    localStorage.setItem('teacher_auth_token', data.token);
  }
  if (data.refresh_token) {
    localStorage.setItem('teacher_refresh_token', data.refresh_token);
  }
  return data;
}

export async function signupTeacher(email, password, fullName, accessCode) {
  let response;
  try {
    response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, accessCode })
    });
  } catch (networkErr) {
    throw new Error('Network error: Cannot reach the server. Please check your connection.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    let errorMsg = data.error || 'Registration failed.';
    if (typeof errorMsg === 'object' || errorMsg === '{}' || errorMsg === '[object Object]') {
      errorMsg = 'Registration failed. Please check your inputs.';
    }
    throw new Error(errorMsg);
  }

  if (data.token) {
    localStorage.setItem('teacher_auth_token', data.token);
  }
  if (data.refresh_token) {
    localStorage.setItem('teacher_refresh_token', data.refresh_token);
  }
  return data;
}

export function logoutTeacher() {
  localStorage.removeItem('teacher_auth_token');
  localStorage.removeItem('teacher_refresh_token');
  localStorage.removeItem('app_access_password');
}

export async function parseQuestionText(rawText) {
  const response = await authenticatedFetch('/api/parse-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'text', rawText })
  });
  return handleApiResponse(response);
}

export async function parseQuestionImage(imageBase64OrFiles, mediaType = 'image/jpeg') {
  let bodyData = { type: 'image' };

  if (Array.isArray(imageBase64OrFiles)) {
    bodyData = { type: 'media', mediaFiles: imageBase64OrFiles };
  } else if (imageBase64OrFiles && typeof imageBase64OrFiles === 'object' && imageBase64OrFiles.mediaFiles) {
    bodyData = { type: 'media', mediaFiles: imageBase64OrFiles.mediaFiles };
  } else {
    bodyData = { type: 'image', imageBase64: imageBase64OrFiles, mediaType };
  }

  const response = await authenticatedFetch('/api/parse-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyData)
  });
  return handleApiResponse(response);
}

export async function parseDocxStructure(docxStructure) {
  const response = await authenticatedFetch('/api/parse-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'docx_structure', docxStructure })
  });
  return handleApiResponse(response);
}

export async function checkServerHealth() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) return { status: 'down' };
    return await response.json();
  } catch (e) {
    return { status: 'offline' };
  }
}

export async function submitStudentTest(payload) {
  try {
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Submission HTTP error ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.warn('[Student Submission Warn]: Server offline or request failed:', err);
    return { success: false, error: err.message };
  }
}

export async function fetchSubmissions() {
  const response = await authenticatedFetch('/api/submissions', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch submissions (${response.status})`);
  }
  return await response.json();
}

export async function gradeSubmission(submissionId, manualGrades) {
  const response = await authenticatedFetch(`/api/submissions/${submissionId}/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manualGrades })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to grade submission (${response.status})`);
  }
  return await response.json();
}

export async function publishExam(payload) {
  // Strip large sourcePageImage base64 strings to keep JSON payload lightweight (< 50KB) and prevent HTTP 413 Payload Too Large errors on Vercel
  const cleanQuestions = (payload?.questions || []).map(q => {
    const cleanDiagramImages = (q.diagramImages || []).map(img => {
      if (!img || typeof img !== 'object') return img;
      const { sourcePageImage, ...rest } = img;
      return rest;
    });
    return {
      ...q,
      diagramImages: cleanDiagramImages
    };
  });

  const cleanPayload = { ...payload, questions: cleanQuestions };

  const response = await authenticatedFetch('/api/exams/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanPayload)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to publish exam (${response.status})`);
  }
  return await response.json();
}


export async function fetchExamSnapshot(examId, rollingCode = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (rollingCode) {
    headers['x-rolling-code'] = rollingCode;
  }
  const url = `/api/exams/${examId}${rollingCode ? `?code=${encodeURIComponent(rollingCode)}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch exam snapshot (${response.status})`);
  }
  return await response.json();
}

export async function fetchExamsList() {
  const response = await authenticatedFetch('/api/exams', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch published exams (${response.status})`);
  }
  return await response.json();
}

export async function toggleExamStatus(examId, status) {
  const response = await authenticatedFetch(`/api/exams/${examId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update exam status (${response.status})`);
  }
  return await response.json();
}

export async function startRollingSession(examId, durationMinutes = 180) {
  const response = await authenticatedFetch('/api/exams/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ examId, durationMinutes })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to start rolling session (${response.status})`);
  }
  return await response.json();
}

export async function extendExamSessionTime(examId, rollingCode, extraMinutes = 10) {
  const response = await authenticatedFetch('/api/exams/session/extend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ examId, rollingCode, extraMinutes })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to extend exam session time (${response.status})`);
  }
  return await response.json();
}

export async function fetchExamSessionStatus(examId, rollingCode) {
  try {
    const params = new URLSearchParams();
    if (examId) params.append('examId', examId);
    if (rollingCode) params.append('rollingCode', rollingCode);

    const response = await fetch(`/api/exams/session/status?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      return { success: false, durationMinutes: 180, extendedMinutes: 0 };
    }
    return await response.json();
  } catch (err) {
    return { success: false, durationMinutes: 180, extendedMinutes: 0 };
  }
}

export function generateAdmissionNumber(prefix = 'DLP') {
  const year = new Date().getFullYear().toString().slice(-2);
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let entropy = '';
  for (let i = 0; i < 5; i++) {
    entropy += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${year}-${entropy}`;
}

export async function loginStudent(admissionNumber, dob) {
  const response = await fetch('/api/student/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admissionNumber, dob })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Student login failed.');
  }
  if (data.token) {
    localStorage.setItem('student_auth_token', data.token);
  }
  if (data.student) {
    localStorage.setItem('student_profile', JSON.stringify(data.student));
  }
  return data;
}

export async function signupStudent(admissionNumber, fullName, dob, teacherCode) {
  const response = await fetch('/api/student/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admissionNumber, fullName, dob, teacherCode })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Student registration failed.');
  }
  if (data.token) {
    localStorage.setItem('student_auth_token', data.token);
  }
  if (data.student) {
    localStorage.setItem('student_profile', JSON.stringify(data.student));
  }
  return data;
}

export function logoutStudent() {
  localStorage.removeItem('student_auth_token');
  localStorage.removeItem('student_profile');
}

export function getStoredStudentProfile() {
  try {
    const raw = localStorage.getItem('student_profile');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function fetchStudentHistory() {
  const token = localStorage.getItem('student_auth_token');
  if (!token) return [];
  const response = await fetch('/api/student/submissions', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch student test history');
  }
  const data = await response.json();
  return data.data || [];
}

export async function teacherCreateStudent(teacherId, admissionNumber, fullName, dob) {
  const response = await authenticatedFetch('/api/teacher/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherId, admissionNumber, fullName, dob })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to enroll student');
  }
  return await response.json();
}

export async function fetchTeacherRoster(teacherId) {
  const response = await authenticatedFetch(`/api/teacher/students?teacherId=${encodeURIComponent(teacherId || '')}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch student roster');
  }
  const data = await response.json();
  return data.data || [];
}

async function handleApiResponse(response) {
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || errData.details || `Server HTTP Error ${response.status}`);
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to parse question data.');
  }
  return result.data;
}

