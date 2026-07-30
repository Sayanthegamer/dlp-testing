/**
 * Client API Service to interface with Express backend proxy.
 * The backend securely attaches ANTHROPIC_API_KEY server-side.
 */

export async function parseQuestionText(rawText) {
  const response = await fetch('/api/parse-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'text', rawText })
  });
  return handleApiResponse(response);
}

export async function parseQuestionImage(imageBase64, mediaType = 'image/jpeg') {
  const response = await fetch('/api/parse-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'image', imageBase64, mediaType })
  });
  return handleApiResponse(response);
}

export async function parseDocxStructure(docxStructure) {
  const response = await fetch('/api/parse-question', {
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
