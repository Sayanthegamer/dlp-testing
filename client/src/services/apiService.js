/**
 * Client API Service to interface with Express backend proxy.
 * The backend securely attaches ANTHROPIC_API_KEY server-side.
 */

function getAuthHeader() {
  const token = localStorage.getItem('teacher_auth_token') || '';
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
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
  return data;
}

export function logoutTeacher() {
  localStorage.removeItem('teacher_auth_token');
  localStorage.removeItem('app_access_password');
}

export async function parseQuestionText(rawText) {
  const response = await fetch('/api/parse-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
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

  const response = await fetch('/api/parse-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(bodyData)
  });
  return handleApiResponse(response);
}

export async function parseDocxStructure(docxStructure) {
  const response = await fetch('/api/parse-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
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
  const response = await fetch('/api/submissions', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch submissions (${response.status})`);
  }
  return await response.json();
}

export async function gradeSubmission(submissionId, manualGrades) {
  const response = await fetch(`/api/submissions/${submissionId}/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
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

  const response = await fetch('/api/exams/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(cleanPayload)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to publish exam (${response.status})`);
  }
  return await response.json();
}


export async function fetchExamSnapshot(examId) {
  const response = await fetch(`/api/exams/${examId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch exam snapshot (${response.status})`);
  }
  return await response.json();
}

export async function fetchExamsList() {
  const response = await fetch('/api/exams', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch published exams (${response.status})`);
  }
  return await response.json();
}

export async function toggleExamStatus(examId, status) {
  const response = await fetch(`/api/exams/${examId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ status })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update exam status (${response.status})`);
  }
  return await response.json();
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
