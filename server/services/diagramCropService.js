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

async function rasterizePdfPage(pdfBase64, pageIndex) {
  try {
    const pdfjsLib = await getPdfJsLib();
    if (!pdfjsLib) throw new Error('pdfjs-dist module unavailable');
    const { createCanvas } = require('canvas');
    const cleanPdf = stripBase64Header(pdfBase64);
    const pdfBuffer = Buffer.from(cleanPdf, 'base64');
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage((pageIndex || 0) + 1);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toBuffer('image/png');
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

    // Check if format is [ymin, xmin, ymax, xmax] (Gemini standard: ymax > ymin and xmax > xmin)
    if (v3 > v1 && v4 > v2 && v3 <= 1.0 && v4 <= 1.0) {
      top = Math.max(0, Math.min(imgHeight - 10, Math.round(v1 * imgHeight)));
      left = Math.max(0, Math.min(imgWidth - 10, Math.round(v2 * imgWidth)));
      height = Math.max(10, Math.min(imgHeight - top, Math.round((v3 - v1) * imgHeight)));
      width = Math.max(10, Math.min(imgWidth - left, Math.round((v4 - v2) * imgWidth)));
    } else if (bbox.some(v => v > 1000)) {
      // Absolute pixel values
      left = Math.max(0, Math.min(imgWidth - 10, Math.round(v1)));
      top = Math.max(0, Math.min(imgHeight - 10, Math.round(v2)));
      width = Math.max(10, Math.min(imgWidth - left, Math.round(v3)));
      height = Math.max(10, Math.min(imgHeight - top, Math.round(v4)));
    } else {
      // Standard [left, top, width, height] normalized ratios
      left = Math.max(0, Math.min(imgWidth - 10, Math.round(v1 * imgWidth)));
      top = Math.max(0, Math.min(imgHeight - 10, Math.round(v2 * imgHeight)));
      width = Math.max(10, Math.min(imgWidth - left, Math.round(v3 * imgWidth)));
      height = Math.max(10, Math.min(imgHeight - top, Math.round(v4 * imgHeight)));
    }

    console.log(`[Diagram Crop Debug] Image size: ${imgWidth}x${imgHeight} | Raw bbox: ${JSON.stringify(bbox)} | Computed crop rect: { left: ${left}, top: ${top}, width: ${width}, height: ${height} }`);

    const cropped = await sharp(sourceBuffer)
      .extract({ left, top, width, height })
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

    return `data:image/png;base64,${cropped.toString('base64')}`;
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
            diagramImages.push({ id: diagId, dataUrl });
            console.log(`[Diagram Crop Pipeline] Question #${i + 1}: Successfully cropped and attached image for diagram ${diagId}.`);
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
