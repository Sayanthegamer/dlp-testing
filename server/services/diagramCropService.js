function stripBase64Header(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/^data:[^;]+;base64,/, '').trim();
}

async function rasterizePdfPage(pdfBase64, pageIndex) {
  try {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    const { createCanvas } = require('canvas');
    const cleanPdf = stripBase64Header(pdfBase64);
    const pdfBuffer = Buffer.from(cleanPdf, 'base64');
    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
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

async function cropDiagram(sourceBuffer, bbox) {
  try {
    const sharp = require('sharp');
    const [x, y, w, h] = bbox;
    const meta = await sharp(sourceBuffer).metadata();
    const imgWidth = meta.width || 800;
    const imgHeight = meta.height || 600;

    // Detect if coordinates are normalized ratios (0-1) or absolute pixel values
    const isPixel = bbox.some(val => val > 1.0);

    let left, top, width, height;
    if (isPixel) {
      left = Math.max(0, Math.min(imgWidth - 10, Math.round(x)));
      top = Math.max(0, Math.min(imgHeight - 10, Math.round(y)));
      width = Math.max(10, Math.min(imgWidth - left, Math.round(w)));
      height = Math.max(10, Math.min(imgHeight - top, Math.round(h)));
    } else {
      left = Math.max(0, Math.min(imgWidth - 10, Math.round(x * imgWidth)));
      top = Math.max(0, Math.min(imgHeight - 10, Math.round(y * imgHeight)));
      width = Math.max(10, Math.min(imgWidth - left, Math.round(w * imgWidth)));
      height = Math.max(10, Math.min(imgHeight - top, Math.round(h * imgHeight)));
    }

    const cropped = await sharp(sourceBuffer)
      .extract({ left, top, width, height })
      .png()
      .toBuffer();

    return `data:image/png;base64,${cropped.toString('base64')}`;
  } catch (err) {
    console.warn('[Diagram Crop Unavailable]:', err.message);
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
    return questions || [];
  }

  try {
    for (const q of questions) {
      if (!Array.isArray(q.diagrams) || q.diagrams.length === 0) continue;

      const diagramImages = [];
      for (const d of q.diagrams) {
        if (!d || !Array.isArray(d.bbox) || d.bbox.length !== 4) continue;
        const fileIdx = (typeof d.sourceFileIndex === 'number' && mediaFiles[d.sourceFileIndex]) ? d.sourceFileIndex : 0;
        const file = mediaFiles[fileIdx];
        if (!file) continue;

        const rawData = file.data || file.base64 || file.imageBase64;
        if (!rawData) continue;

        try {
          let sourceBuffer;
          const mime = file.mimeType || file.mediaType || 'image/jpeg';
          if (mime === 'application/pdf') {
            sourceBuffer = await rasterizePdfPage(rawData, d.pageIndex || 0);
          } else {
            const cleanStr = stripBase64Header(rawData);
            sourceBuffer = Buffer.from(cleanStr, 'base64');
          }
          const dataUrl = await cropDiagram(sourceBuffer, d.bbox);
          if (dataUrl) {
            diagramImages.push({ id: d.id || `diag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, dataUrl });
          }
        } catch (err) {
          console.warn(`[Diagram Crop Warning] Failed for diagram ${d.id}:`, err.message);
        }
      }
      q.diagramImages = diagramImages;
      q.diagramsConfirmed = false; // Always force teacher review pass for cropped diagrams
    }
  } catch (err) {
    console.warn('[attachCroppedDiagrams soft-degrade]:', err.message);
    return questions;
  }

  return questions;
}

module.exports = { attachCroppedDiagrams, cropDiagram, rasterizePdfPage };
