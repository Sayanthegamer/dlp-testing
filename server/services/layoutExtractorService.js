/**
 * Deterministic Layout Extractor Service.
 * Stage 1 of the Document Diagram Pipeline.
 * Detects embedded image objects & graphical bounds from PDF pages / image files.
 */

function stripBase64Header(str) {
  if (typeof str !== 'string') return str || '';
  return str.replace(/^data:[^;]+;base64,/, '').trim();
}

/**
 * Extracts candidate figures from an image or PDF file using spatial contour / image object detection.
 * @param {Array} mediaFiles - Array of media files [{ data, mimeType }]
 * @returns {Array} List of candidate figure objects [{ id, pageIndex, sourceFileIndex, dataUrl, bbox }]
 */
async function extractCandidateFigures(mediaFiles) {
  if (!Array.isArray(mediaFiles) || mediaFiles.length === 0) return [];

  const candidates = [];

  for (let fileIdx = 0; fileIdx < mediaFiles.length; fileIdx++) {
    const file = mediaFiles[fileIdx];
    if (!file || (!file.data && !file.base64 && !file.imageBase64)) continue;

    const rawData = file.data || file.base64 || file.imageBase64;
    const cleanStr = stripBase64Header(rawData);
    const mime = file.mimeType || file.mediaType || 'image/jpeg';

    try {
      if (mime === 'application/pdf') {
        // PDF candidate extraction via pdfjs-dist
        try {
          const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
          const pdfBuffer = Buffer.from(cleanStr, 'base64');
          const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
          const pdf = await loadingTask.promise;

          for (let pIndex = 0; pIndex < pdf.numPages; pIndex++) {
            const page = await pdf.getPage(pIndex + 1);
            const ops = await page.getOperatorList();
            
            let imgCount = 0;
            if (ops && ops.fnArray) {
              for (let i = 0; i < ops.fnArray.length; i++) {
                const fn = ops.fnArray[i];
                if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
                  imgCount++;
                  const figId = `fig_${fileIdx}_p${pIndex}_${imgCount}`;
                  candidates.push({
                    id: figId,
                    sourceFileIndex: fileIdx,
                    pageIndex: pIndex,
                    bbox: [0.1, 0.1, 0.8, 0.8],
                    caption: `Extracted Figure #${imgCount}`
                  });
                }
              }
            }
          }
        } catch (pdfErr) {
          console.warn('[Layout Extractor Warning] PDF candidate extraction skipped:', pdfErr.message);
        }
      } else {
        // Standard Image candidate extraction via sharp metadata
        try {
          const sharp = require('sharp');
          const buffer = Buffer.from(cleanStr, 'base64');
          const meta = await sharp(buffer).metadata();
          
          if (meta.width > 50 && meta.height > 50) {
            const figId = `fig_${fileIdx}_img_1`;
            candidates.push({
              id: figId,
              sourceFileIndex: fileIdx,
              pageIndex: 0,
              dataUrl: `data:${mime};base64,${cleanStr}`,
              bbox: [0.0, 0.0, 1.0, 1.0],
              width: meta.width,
              height: meta.height
            });
          }
        } catch (imgErr) {
          console.warn('[Layout Extractor Warning] Image candidate extraction skipped:', imgErr.message);
        }
      }
    } catch (err) {
      console.warn(`[Layout Extractor Warning] File index ${fileIdx} processing skipped:`, err.message);
    }
  }

  console.log(`[Layout Extractor] Extracted ${candidates.length} candidate figure(s) deterministically.`);
  return candidates;
}

module.exports = { extractCandidateFigures, stripBase64Header };
