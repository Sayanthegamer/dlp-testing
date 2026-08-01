/**
 * Diagram Matcher Service.
 * Stage 3 of the Document Diagram Pipeline.
 * Matches extracted candidate figures to parsed questions using spatial proximity & explicit diagram phrases.
 * Respects empty q.diagrams = [] returned by LLM to prevent false-positive diagram attachments.
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

  const explicitDiagramPhrases = /shown in (the )?(figure|diagram|circuit|setup)|(circuit|figure|diagram) (shown|below)|in the (given|following) (circuit|figure|diagram)|refer to (the )?(figure|diagram|circuit)/i;

  let candidateIdx = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    // If LLM explicitly outputted an empty diagrams array [], respect it and do not force a diagram!
    if (Array.isArray(q.diagrams) && q.diagrams.length === 0) {
      continue;
    }

    const questionText = q.questionText || '';
    const hasExplicitPhrase = explicitDiagramPhrases.test(questionText);

    // If q.diagrams is undefined but question text explicitly refers to a diagram/figure
    if (!Array.isArray(q.diagrams) && hasExplicitPhrase) {
      const candidate = (Array.isArray(candidateFigures) && candidateFigures.length > 0)
        ? (candidateFigures[candidateIdx] || candidateFigures[0])
        : null;

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

  // Run crop & attachment service for questions with non-empty diagrams
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
