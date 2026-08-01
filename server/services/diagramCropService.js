const fs = require('fs');
const path = require('path');

function stripBase64Header(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/^data:[^;]+;base64,/, '').trim();
}

async function getPdfJsLib() {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    return pdfjs.default || pdfjs;
  } catch (e1) {
    try {
      const pdfjs = await import('pdfjs-dist');
      return pdfjs.default || pdfjs;
    } catch (e2) {
      console.warn('[PDF.js import error]:', e2.message);
      return null;
    }
  }
}

function getCreateCanvas() {
  try {
    const { createCanvas } = require('@napi-rs/canvas');
    return createCanvas;
  } catch (e1) {
    try {
      const { createCanvas } = require('canvas');
      return createCanvas;
    } catch (e2) {
      console.warn('[Canvas library missing]:', e2.message);
      return null;
    }
  }
}

async function rasterizePdfPage(pdfBase64, pageIndex) {
  try {
    const pdfjsLib = await getPdfJsLib();
    if (!pdfjsLib) throw new Error('pdfjs-dist module unavailable');
    const createCanvas = getCreateCanvas();
    if (!createCanvas) throw new Error('canvas library unavailable');

    const cleanPdf = stripBase64Header(pdfBase64);
    const pdfBuffer = Buffer.from(cleanPdf, 'base64');
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage((pageIndex || 0) + 1);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    if (typeof canvas.toBuffer === 'function') {
      return canvas.toBuffer('image/png');
    } else if (typeof canvas.toBufferAsync === 'function') {
      return await canvas.toBufferAsync('image/png');
    }
    return Buffer.from(canvas.toDataURL().replace(/^data:image\/png;base64,/, ''), 'base64');
  } catch (err) {
    console.warn('[PDF Rasterization Unavailable]:', err.message);
    const cleanPdf = stripBase64Header(pdfBase64);
    return Buffer.from(cleanPdf, 'base64');
  }
}

async function cropDiagram(sourceBuffer, bbox, debugLabel = 'diag') {
  try {
    const sharp = require('sharp');
    const meta = await sharp(sourceBuffer).metadata();
    const imgWidth = meta.width || 800;
    const imgHeight = meta.height || 600;

    let [v1, v2, v3, v4] = bbox.map(v => parseFloat(v) || 0);

    // If coordinates are in 0-1000 scale (standard Gemini Vision format), normalize to 0-1
    if (bbox.some(v => v > 1.0 && v <= 1000)) {
      v1 = v1 / 1000;
      v2 = v2 / 1000;
      v3 = v3 / 1000;
      v4 = v4 / 1000;
    }

    let left, top, width, height;

    if (v3 > v1 && v4 > v2) {
      // Handles both [ymin, xmin, ymax, xmax] (Gemini Vision standard) and [xmin, ymin, xmax, ymax]
      // v1, v3 span one axis; v2, v4 span the other axis
      const dim1_min = Math.min(v1, v3);
      const dim1_max = Math.max(v1, v3);
      const dim2_min = Math.min(v2, v4);
      const dim2_max = Math.max(v2, v4);

      if (dim1_max <= 1.0 && dim2_max <= 1.0) {
        // Normalized 0.0 to 1.0
        // Determine which dimension is Y (height) vs X (width) based on aspect ratio or standard ymin/xmin
        top = Math.round(dim1_min * imgHeight);
        left = Math.round(dim2_min * imgWidth);
        height = Math.round((dim1_max - dim1_min) * imgHeight);
        width = Math.round((dim2_max - dim2_min) * imgWidth);
      } else {
        // Absolute pixel values
        top = Math.round(dim1_min);
        left = Math.round(dim2_min);
        height = Math.round(dim1_max - dim1_min);
        width = Math.round(dim2_max - dim2_min);
      }
    } else {
      // Fallback: [left, top, width, height] format
      left = Math.round(v1 > 1.0 ? v1 : v1 * imgWidth);
      top = Math.round(v2 > 1.0 ? v2 : v2 * imgHeight);
      width = Math.round(v3 > 1.0 ? v3 : v3 * imgWidth);
      height = Math.round(v4 > 1.0 ? v4 : v4 * imgHeight);
    }


    // Filter out tiny edge noise boxes (e.g. less than 30px width or height)
    if (width < 30 || height < 30) {
      console.warn(`[Diagram Crop Warning] BBox ${JSON.stringify(bbox)} produced tiny noise box (${width}x${height}). Expanding to safe default.`);
      width = Math.max(150, width);
      height = Math.max(150, height);
      left = Math.max(0, left - 40);
      top = Math.max(0, top - 40);
    }

    // Bound coordinates inside image canvas
    left = Math.max(0, Math.min(imgWidth - 20, left));
    top = Math.max(0, Math.min(imgHeight - 20, top));
    width = Math.max(40, Math.min(imgWidth - left, width));
    height = Math.max(40, Math.min(imgHeight - top, height));

    // Generous 12% safety margin padding + 16px minimum buffer so diagram edges & labels are NEVER cut off
    const padX = Math.max(16, Math.round(width * 0.12));
    const padY = Math.max(16, Math.round(height * 0.12));

    const finalLeft = Math.round(Math.max(0, left - padX));
    const finalTop = Math.round(Math.max(0, top - padY));
    const finalWidth = Math.round(Math.max(40, Math.min(imgWidth - finalLeft, width + padX * 2)));
    const finalHeight = Math.round(Math.max(40, Math.min(imgHeight - finalTop, height + padY * 2)));

    console.log(`[Diagram Crop Debug] Image size: ${imgWidth}x${imgHeight} | Raw bbox: ${JSON.stringify(bbox)} | Padded crop rect: { left: ${finalLeft}, top: ${finalTop}, width: ${finalWidth}, height: ${finalHeight} }`);


    const cropped = await sharp(sourceBuffer)
      .extract({ left: finalLeft, top: finalTop, width: finalWidth, height: finalHeight })
      .png()
      .toBuffer();


    // Save debug crop PNG to server/data/ directory for visual inspection
    try {
      const debugDir = path.join(__dirname, '../data');
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
      const debugFilePath = path.join(debugDir, `debug_crop_${debugLabel}.png`);
      fs.writeFileSync(debugFilePath, cropped);
      console.log(`[Diagram Crop Debug] Saved debug crop image to: ${debugFilePath}`);
    } catch (saveErr) {
      console.warn('[Diagram Crop Debug Warning] Could not write debug crop file:', saveErr.message);
    }

    const { uploadDiagramToStorage } = require('./supabaseClient');
    const fileName = `${debugLabel}_${Date.now()}.png`;
    return await uploadDiagramToStorage(cropped, fileName);
  } catch (err) {
    console.warn('[Diagram Crop Error]:', err.message);
    return null;
  }
}

/**
 * Attaches base64 cropped diagram images to parsed questions.
 * Soft-degrades gracefully if native image libraries are unavailable.
 * @param {Array} questions - Array of parsed question objects
 * @param {Array} mediaFiles - Original media files [{ data, mimeType }]
 */
async function attachCroppedDiagrams(questions, mediaFiles) {
  if (!Array.isArray(questions) || !Array.isArray(mediaFiles) || mediaFiles.length === 0) {
    console.log('[Diagram Crop Pipeline] Skipped: No questions array or media files provided.');
    return questions || [];
  }

  try {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!Array.isArray(q.diagrams) || q.diagrams.length === 0) {
        console.log(`[Diagram Crop Pipeline] Question #${i + 1} (${q.id}): 0 diagrams declared.`);
        continue;
      }

      console.log(`[Diagram Crop Pipeline] Question #${i + 1} (${q.id}): ${q.diagrams.length} diagram(s) declared:`, JSON.stringify(q.diagrams));
      const diagramImages = [];

      for (const d of q.diagrams) {
        if (!d || !Array.isArray(d.bbox) || d.bbox.length !== 4) {
          console.warn(`[Diagram Crop Pipeline] Question #${i + 1}: Skipping invalid bbox metadata:`, d);
          continue;
        }

        const fileIdx = (typeof d.sourceFileIndex === 'number' && mediaFiles[d.sourceFileIndex]) ? d.sourceFileIndex : 0;
        const file = mediaFiles[fileIdx];
        if (!file) {
          console.warn(`[Diagram Crop Pipeline] Question #${i + 1}: Source file index ${fileIdx} not found in mediaFiles.`);
          continue;
        }

        const rawData = file.data || file.base64 || file.imageBase64;
        if (!rawData) {
          console.warn(`[Diagram Crop Pipeline] Question #${i + 1}: Empty base64 payload for file index ${fileIdx}.`);
          continue;
        }

        try {
          let sourceBuffer;
          const mime = file.mimeType || file.mediaType || 'image/jpeg';
          if (mime === 'application/pdf') {
            sourceBuffer = await rasterizePdfPage(rawData, d.pageIndex || 0);
          } else {
            const cleanStr = stripBase64Header(rawData);
            sourceBuffer = Buffer.from(cleanStr, 'base64');
          }
          const diagId = d.id || `diag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const dataUrl = await cropDiagram(sourceBuffer, d.bbox, `q${i + 1}_${diagId}`);
          if (dataUrl) {
            const sourceMime = (mime === 'application/pdf') ? 'image/png' : mime;
            const sourcePageImage = `data:${sourceMime};base64,${sourceBuffer.toString('base64')}`;
            diagramImages.push({ id: diagId, dataUrl, sourcePageImage });
            console.log(`[Diagram Crop Pipeline] Question #${i + 1}: Successfully cropped and attached image + sourcePageImage for diagram ${diagId}.`);
          } else {

            console.warn(`[Diagram Crop Pipeline] Question #${i + 1}: cropDiagram returned null for diagram ${d.id}.`);
          }
        } catch (err) {
          console.warn(`[Diagram Crop Pipeline Warning] Question #${i + 1} crop failed for diagram ${d.id}:`, err.message);
        }
      }

      q.diagramImages = diagramImages;
      q.diagramsConfirmed = false; // Always force teacher review pass for cropped diagrams
      console.log(`[Diagram Crop Pipeline] Question #${i + 1}: Attached ${diagramImages.length} cropped image(s) total.`);
    }
  } catch (err) {
    console.warn('[attachCroppedDiagrams soft-degrade]:', err.message);
    return questions;
  }

  return questions;
}

module.exports = { attachCroppedDiagrams, cropDiagram, rasterizePdfPage, stripBase64Header };
