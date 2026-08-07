/**
 * Layout & Diagram Matcher Evaluation Service.
 * Provides diagnostic visual overlay for question-figure matching decisions
 * and computes Precision / Recall / Attachment Accuracy metrics.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * Renders a visual match diagnostic overlay showing Question -> Matched Figure associations.
 * Saves image to server/data/debug_match_{fileLabel}.png.
 */
async function generateMatchOverlay(sourceBuffer, questions, fileLabel) {
  if (!Array.isArray(questions) || questions.length === 0) return;
  if (process.env.NODE_ENV === 'production') return;

  try {
    const meta = await sharp(sourceBuffer).metadata();
    const width = meta.width || 800;
    const height = meta.height || 600;

    let svgElements = '';

    questions.forEach((q, qIdx) => {
      if (Array.isArray(q.diagrams) && q.diagrams.length > 0) {
        q.diagrams.forEach((d) => {
          const [x, y, w, h] = d.bbox || [0.1, 0.1, 0.8, 0.8];
          const left = Math.round(x * width);
          const top = Math.round(y * height);
          const rectW = Math.round(w * width);
          const rectH = Math.round(h * height);

          // Draw matched figure box
          svgElements += `
            <rect x="${left}" y="${top}" width="${rectW}" height="${rectH}" fill="none" stroke="#3b82f6" stroke-width="4" stroke-dasharray="4,4"/>
            <rect x="${left}" y="${Math.max(0, top - 26)}" width="${Math.min(360, rectW)}" height="26" fill="#3b82f6" opacity="0.95"/>
            <text x="${left + 6}" y="${Math.max(18, top - 8)}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff">Question #${qIdx + 1} ➔ ${d.id || 'Matched Figure'}</text>
          `;
        });
      }
    });

    if (!svgElements) return;

    const svgOverlay = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`;
    const annotatedBuffer = await sharp(sourceBuffer)
      .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
      .png()
      .toBuffer();

    const debugDir = path.join(__dirname, '../data');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    const debugFilePath = path.join(debugDir, `debug_match_${fileLabel}.png`);
    fs.writeFileSync(debugFilePath, annotatedBuffer);
    console.log(`[Matcher Diagnostic Overlay] Saved question-figure match overlay to: ${debugFilePath}`);
  } catch (err) {
    console.warn('[Matcher Diagnostic Overlay Warning] Could not render match overlay:', err.message);
  }
}

/**
 * Computes objective evaluation metrics for candidate figure detection & question attachment.
 * @param {Array} testResults - Array of test evaluation records [{ actualFigures, detectedFigures, correctBoxes, correctAttachments }]
 * @returns {Object} Metric summary { precision, recall, attachmentAccuracy }
 */
function evaluateLayoutMetrics(testResults = []) {
  let totalActual = 0;
  let totalDetected = 0;
  let totalCorrectBoxes = 0;
  let totalCorrectAttachments = 0;

  testResults.forEach((r) => {
    totalActual += r.actualFigures || 0;
    totalDetected += r.detectedFigures || 0;
    totalCorrectBoxes += r.correctBoxes || 0;
    totalCorrectAttachments += r.correctAttachments || 0;
  });

  const recall = totalActual > 0 ? (totalCorrectBoxes / totalActual) * 100 : 100;
  const precision = totalDetected > 0 ? (totalCorrectBoxes / totalDetected) * 100 : 100;
  const attachmentAccuracy = totalActual > 0 ? (totalCorrectAttachments / totalActual) * 100 : 100;

  return {
    totalActualFigures: totalActual,
    totalDetectedFigures: totalDetected,
    correctlyBoxedFigures: totalCorrectBoxes,
    correctlyAttachedFigures: totalCorrectAttachments,
    detectionRecallPercent: Math.round(recall * 10) / 10,
    detectionPrecisionPercent: Math.round(precision * 10) / 10,
    attachmentAccuracyPercent: Math.round(attachmentAccuracy * 10) / 10
  };
}

module.exports = { generateMatchOverlay, evaluateLayoutMetrics };
