/**
 * Deterministic Layout Extractor Service.
 * Stage 1 of the Document Diagram Pipeline.
 * Detects both embedded image XObjects AND vector path drawings (circuits, graphs, shapes) from PDF pages / images.
 */

function stripBase64Header(str) {
  if (typeof str !== 'string') return str || '';
  return str.replace(/^data:[^;]+;base64,/, '').trim();
}

/**
 * Extracts candidate figures (bitmaps & vector drawings) from an image or PDF file.
 * @param {Array} mediaFiles - Array of media files [{ data, mimeType }]
 * @returns {Array} List of candidate figure objects [{ id, pageIndex, sourceFileIndex, dataUrl, bbox, type }]
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
            let vectorCount = 0;
            let textCount = 0;
            const pageCandidates = [];

            if (ops && ops.fnArray) {
              for (let i = 0; i < ops.fnArray.length; i++) {
                const fn = ops.fnArray[i];

                // 1. Detect embedded bitmap images (paintImageXObject / paintInlineImageXObject)
                if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
                  imgCount++;
                  const figId = `fig_${fileIdx}_p${pIndex}_img_${imgCount}`;
                  pageCandidates.push({
                    id: figId,
                    sourceFileIndex: fileIdx,
                    pageIndex: pIndex,
                    type: 'bitmap_image',
                    bbox: [0.1, 0.1, 0.8, 0.8],
                    caption: `Extracted Image #${imgCount}`
                  });
                }

                // 2. Detect vector path primitives (constructPath, stroke, fill, curveTo, lineTo)
                if (
                  fn === pdfjsLib.OPS.constructPath ||
                  fn === pdfjsLib.OPS.stroke ||
                  fn === pdfjsLib.OPS.fill ||
                  fn === pdfjsLib.OPS.curveTo ||
                  fn === pdfjsLib.OPS.lineTo
                ) {
                  vectorCount++;
                }

                // 3. Detect text operators (showText, showSpans)
                if (fn === pdfjsLib.OPS.showText || fn === pdfjsLib.OPS.showSpans) {
                  textCount++;
                }
              }

              // If page has vector drawings (e.g. circuits, graphs, apparatus, geometry paths)
              if (vectorCount >= 10) {
                const vectorFigId = `fig_${fileIdx}_p${pIndex}_vector_1`;
                pageCandidates.push({
                  id: vectorFigId,
                  sourceFileIndex: fileIdx,
                  pageIndex: pIndex,
                  type: 'vector_drawing',
                  bbox: [0.1, 0.15, 0.8, 0.7],
                  caption: `Extracted Vector Drawing (${vectorCount} primitives)`
                });
              }
            }

            console.log(
              `[Layout Extractor] Page ${pIndex + 1}: Text blocks: ${textCount}, Image XObjects: ${imgCount}, Vector paths: ${vectorCount}, Candidate figures: ${pageCandidates.length}`
            );

            candidates.push(...pageCandidates);
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
              type: 'image_upload',
              dataUrl: `data:${mime};base64,${cleanStr}`,
              bbox: [0.0, 0.0, 1.0, 1.0],
              width: meta.width,
              height: meta.height
            });
            console.log(`[Layout Extractor] Image upload (file index ${fileIdx}): Candidate figure ${figId} registered (${meta.width}x${meta.height}).`);
          }
        } catch (imgErr) {
          console.warn('[Layout Extractor Warning] Image candidate extraction skipped:', imgErr.message);
        }
      }
    } catch (err) {
      console.warn(`[Layout Extractor Warning] File index ${fileIdx} processing skipped:`, err.message);
    }
  }

  console.log(`[Layout Extractor Summary] Total candidate figures extracted: ${candidates.length}`);
  return candidates;
}

module.exports = { extractCandidateFigures, stripBase64Header };
