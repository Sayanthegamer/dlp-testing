async function rasterizePdfPage(pdfBase64, pageIndex) {
  try {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    const { createCanvas } = require('canvas');
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
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
    return Buffer.from(pdfBase64, 'base64');
  }
}

async function cropDiagram(sourceBuffer, bbox) {
  try {
    const sharp = require('sharp');
    const [x, y, w, h] = bbox;
    const meta = await sharp(sourceBuffer).metadata();
    const imgWidth = meta.width || 800;
    const imgHeight = meta.height || 600;

    const left = Math.max(0, Math.min(imgWidth - 10, Math.round(x * imgWidth)));
    const top = Math.max(0, Math.min(imgHeight - 10, Math.round(y * imgHeight)));
    const width = Math.max(10, Math.min(imgWidth - left, Math.round(w * imgWidth)));
    const height = Math.max(10, Math.min(imgHeight - top, Math.round(h * imgHeight)));

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
  if (!Array.isArray(questions)) return questions || [];

  try {
    for (const q of questions) {
      if (!Array.isArray(q.diagrams) || q.diagrams.length === 0) continue;

      const diagramImages = [];
      for (const d of q.diagrams) {
        if (!d || typeof d.sourceFileIndex !== 'number' || !Array.isArray(d.bbox) || d.bbox.length !== 4) continue;
        const file = mediaFiles && mediaFiles[d.sourceFileIndex];
        if (!file || !file.data) continue;

        try {
          let sourceBuffer;
          if (file.mimeType === 'application/pdf') {
            sourceBuffer = await rasterizePdfPage(file.data, d.pageIndex || 0);
          } else {
            sourceBuffer = Buffer.from(file.data, 'base64');
          }
          const dataUrl = await cropDiagram(sourceBuffer, d.bbox);
          if (dataUrl) {
            diagramImages.push({ id: d.id || `diag_${Date.now()}`, dataUrl });
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
