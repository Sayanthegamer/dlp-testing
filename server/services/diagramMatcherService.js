/**
 * Diagram Matcher Service.
 * Stage 3 of the Document Diagram Pipeline.
 * Matches extracted candidate figures to parsed questions using spatial proximity & diagram keywords,
 * and generates visual match decision overlays.
 */

const { attachCroppedDiagrams, rasterizePdfPage, stripBase64Header } = require('./diagramCropService');
const { generateMatchOverlay } = require('./layoutEvaluatorService');

/**
 * Matches candidate figures to questions.
 * @param {Array} questions - Array of parsed question objects
 * @param {Array} candidateFigures - Array of candidate figure objects
 * @param {Array} mediaFiles - Array of media files
 * @returns {Array} Updated questions array with attached diagramImages & diagrams metadata
 */
async function matchDiagramsToQuestions(questions, candidateFigures, mediaFiles) {
  if (!Array.isArray(questions) || questions.length === 0) return questions || [];

  const diagramKeywords = /diagram|figure|circuit|graph|plot|benzene|structure|apparatus|molecule|setup|shown below|in the figure/i;

  let candidateIdx = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const textToTest = `${q.questionText || ''} ${(q.options || []).join(' ')}`;
    const hasDiagramMention = diagramKeywords.test(textToTest);

    // If question has explicit diagrams array from LLM or mentions a diagram/figure
    if ((Array.isArray(q.diagrams) && q.diagrams.length > 0) || hasDiagramMention) {
      if (!Array.isArray(q.diagrams) || q.diagrams.length === 0) {
        // If LLM didn't invent a bbox, assign next candidate figure or create a default figure reference
        const candidate = candidateFigures[candidateIdx] || candidateFigures[0];
        if (candidate) {
          q.diagrams = [
            {
              id: candidate.id || `diag_q${i + 1}_1`,
              sourceFileIndex: candidate.sourceFileIndex || 0,
              pageIndex: candidate.pageIndex || 0,
              bbox: candidate.bbox || [0.1, 0.1, 0.8, 0.8],
              caption: candidate.caption || 'Extracted Figure'
            }
          ];
          candidateIdx++;
        }
      }
    }
  }

  // Run crop & attachment service for all questions with diagrams
  const updatedQuestions = await attachCroppedDiagrams(questions, mediaFiles);

  // Generate Match Decision Visual Overlay for visual validation
  if (Array.isArray(mediaFiles) && mediaFiles.length > 0) {
    try {
      for (let fIdx = 0; fIdx < mediaFiles.length; fIdx++) {
        const file = mediaFiles[fIdx];
        if (!file) continue;
        const rawData = file.data || file.base64 || file.imageBase64;
        if (!rawData) continue;
        const mime = file.mimeType || file.mediaType || 'image/jpeg';

        let sourceBuffer;
        if (mime === 'application/pdf') {
          sourceBuffer = await rasterizePdfPage(rawData, 0);
        } else {
          const cleanStr = stripBase64Header(rawData);
          sourceBuffer = Buffer.from(cleanStr, 'base64');
        }

        await generateMatchOverlay(sourceBuffer, updatedQuestions, `file${fIdx}`);
      }
    } catch (ovErr) {
      console.warn('[Matcher Diagnostic Overlay Warning]:', ovErr.message);
    }
  }

  return updatedQuestions;
}

module.exports = { matchDiagramsToQuestions };
