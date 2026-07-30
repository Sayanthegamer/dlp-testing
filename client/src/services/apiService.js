/**
 * Client API Service to interface with Express backend proxy.
 * The backend securely attaches ANTHROPIC_API_KEY server-side.
 */

function getAuthHeader() {
  const pwd = localStorage.getItem('app_access_password') || '';
  return { 'X-App-Password': pwd };
}

export async function verifyPassword(password) {
  let response;
  try {
    response = await fetch('/api/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
  } catch (networkErr) {
    throw new Error('Network error: Cannot reach the server. Please check your connection.');
  }

  if (!response.ok) {
    // Try to parse JSON error from our API
    let errBody;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      errBody = await response.json().catch(() => null);
    }

    if (errBody && errBody.error) {
      throw new Error(errBody.error);
    }

    // Non-JSON response (e.g. Vercel 502 HTML error page) means the serverless function crashed
    if (response.status >= 500) {
      throw new Error(`Server error (${response.status}): The API function failed to start. Check Vercel deployment logs.`);
    }

    throw new Error(`Authentication failed (${response.status}).`);
  }
  return true;
}

export async function parseQuestionText(rawText) {
  const response = await fetch('/api/parse-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ type: 'text', rawText })
  });
  return handleApiResponse(response);
}

export async function parseQuestionImage(imageBase64, mediaType = 'image/jpeg') {
  const response = await fetch('/api/parse-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ type: 'image', imageBase64, mediaType })
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
