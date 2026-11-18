const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { uploadDiagramToStorage } = require('./supabaseClient');

let sharpInstance = null;
function getSharp() {
  if (sharpInstance !== null) return sharpInstance || null;
  try {
    sharpInstance = require('sharp');
    return sharpInstance;
  } catch (err) {
    console.warn('[Sharp unavailable]:', err.message);
    sharpInstance = false;
    return null;
  }
}

function stripBase64Header(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/^data:[^;]+;base64,/, '').trim();
}

/**
 * Checks whether a Buffer starts with valid PNG (\x89PNG\r\n\x1a\n) or JPEG (\xff\xd8\xff) magic bytes.
 */
function isRasterImageBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8) return false;
  const isPng =
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  return isPng || isJpeg;
}

/**
 * Finds the matching opening `<<` for a dictionary closing at `closeDictIdx` (which points to the first `>` of `>>`).
 * Handles arbitrarily nested `<< ... >>` (such as `/DecodeParms << ... >>`) in O(dict_length) without regex backtracking.
 */
function findMatchingDictStart(str, closeDictIdx, minSearchIdx = 0) {
  let depth = 0;
  const floor = Math.max(0, minSearchIdx);
  for (let i = closeDictIdx; i >= floor; i--) {
    if (str[i] === '>' && i + 1 <= closeDictIdx + 1 && str[i + 1] === '>') {
      depth++;
      i--; // step over pair
    } else if (str[i] === '<' && i + 1 <= closeDictIdx && str[i + 1] === '<') {
      depth--;
      if (depth === 0) {
        return i;
      }
      i--;
    }
  }
  return -1;
}

/**
 * Linearly scans a PDF buffer for embedded `/DCTDecode` JPEG streams, AND strictly gates extraction
 * to genuine image-only scanned PDFs (0 `/Font` / `/BaseFont` resources, 1 full-page JPEG per PDF `/Page`,
 * excluding any `/SMask` transparency objects and nested sub-page diagram figures).
 *
 * Digital PDFs containing text questions + embedded diagram figures return `[]` so their text is never dropped.
 *
 * @param {Buffer} pdfBuffer
 * @returns {Array<{ buffer: Buffer, width: number, height: number, mimeType: string }>}
 */
function extractEmbeddedJpegsFromPdf(pdfBuffer) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 64) return [];

  const str = pdfBuffer.toString('latin1');

  // Gate 1: If the PDF defines any font resources (/Font or /BaseFont), it is a digital/text PDF (or hybrid PDF),
  // NOT an image-only scan. Never replace a digital text PDF with its embedded diagram JPEGs.
  if (/\/(?:BaseFont|Font)\b/.test(str)) {
    return [];
  }

  const pageMatches = str.match(/\/Type\s*\/Page\b(?!s)/g);
  const pageCount = pageMatches ? pageMatches.length : 0;
  if (pageCount === 0) return [];

  // Collect any object numbers referenced as /SMask so transparency masks are never extracted as pages
  const smaskObjIds = new Set();
  const smaskRegex = /\/SMask\s+(\d+)\s+\d+\s+R\b/g;
  let smMatch;
  while ((smMatch = smaskRegex.exec(str)) !== null) {
    smaskObjIds.add(parseInt(smMatch[1], 10));
  }

  const jpegs = [];
  let cursor = 0;

  while (cursor < str.length) {
    const streamIdx = str.indexOf('stream', cursor);
    if (streamIdx === -1) break;

    // Ensure 'stream' is not the tail of 'endstream'
    if (streamIdx >= 3 && str.substring(streamIdx - 3, streamIdx) === 'end') {
      cursor = streamIdx + 6;
      continue;
    }

    // Advance past 'stream' and its mandatory EOL (\r\n, \n, or \r)
    let dataStart = streamIdx + 6;
    if (str[dataStart] === '\r' && str[dataStart + 1] === '\n') {
      dataStart += 2;
    } else if (str[dataStart] === '\n' || str[dataStart] === '\r') {
      dataStart += 1;
    } else {
      cursor = streamIdx + 6;
      continue;
    }

    // Walk backward across whitespace from `streamIdx` to find `>>`
    let closeIdx = streamIdx - 1;
    while (closeIdx >= 0 && (str[closeIdx] === ' ' || str[closeIdx] === '\t' || str[closeIdx] === '\r' || str[closeIdx] === '\n')) {
      closeIdx--;
    }

    if (closeIdx < 1 || str[closeIdx] !== '>' || str[closeIdx - 1] !== '>') {
      cursor = dataStart;
      continue;
    }

    const dictStart = findMatchingDictStart(str, closeIdx - 1, Math.max(0, closeIdx - 4096));
    if (dictStart === -1) {
      cursor = dataStart;
      continue;
    }

    const dict = str.substring(dictStart, closeIdx + 1);

    // Check enclosing object ID (e.g. "16 0 obj") before dictStart to filter out /SMask objects
    const objHeaderSlice = str.substring(Math.max(0, dictStart - 64), dictStart);
    const objMatch = objHeaderSlice.match(/(\d+)\s+\d+\s+obj\s*$/);
    const objId = objMatch ? parseInt(objMatch[1], 10) : null;

    if (objId !== null && smaskObjIds.has(objId)) {
      cursor = dataStart;
      continue;
    }

    const isDct = /\/Filter\s*(?:\[\s*)?\/DCTDecode\b/.test(dict);
    const isSmaskSubtype = /\/SMaskInData\b/.test(dict);

    if (!isDct || isSmaskSubtype) {
      cursor = dataStart;
      continue;
    }

    const widthMatch = dict.match(/\/Width\s+(\d+)/);
    const heightMatch = dict.match(/\/Height\s+(\d+)/);
    const width = widthMatch ? parseInt(widthMatch[1], 10) : 0;
    const height = heightMatch ? parseInt(heightMatch[1], 10) : 0;

    // Require page-scale dimensions (>= 500x500) so small thumbnails/icons are ignored
    if (width < 500 || height < 500) {
      cursor = dataStart;
      continue;
    }

    const lenMatch = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
    let dataEnd = -1;
    if (lenMatch) {
      const declaredLen = parseInt(lenMatch[1], 10);
      if (declaredLen > 100 && dataStart + declaredLen <= pdfBuffer.length) {
        dataEnd = dataStart + declaredLen;
      }
    }
    if (dataEnd === -1) {
      const endStreamIdx = str.indexOf('endstream', dataStart);
      if (endStreamIdx !== -1) {
        dataEnd = endStreamIdx;
        while (dataEnd > dataStart && (pdfBuffer[dataEnd - 1] === 0x0a || pdfBuffer[dataEnd - 1] === 0x0d)) {
          dataEnd--;
        }
      }
    }

    if (dataEnd > dataStart && pdfBuffer[dataStart] === 0xff && pdfBuffer[dataStart + 1] === 0xd8) {
      jpegs.push({
        buffer: pdfBuffer.slice(dataStart, dataEnd),
        width,
        height,
        mimeType: 'image/jpeg',
      });
      cursor = dataEnd + 9;
    } else {
      cursor = dataStart;
    }
  }

  // Gate 2: Only return extracted JPEGs if there is an exact 1:1 correspondence with the PDF's page count
  if (jpegs.length !== pageCount) {
    return [];
  }

  return jpegs;
}

/**
 * Counts the number of pages in a PDF buffer using pure-JS structure inspection as a fallback when pdfjs-dist is unavailable.
 */
function countPdfPagesPureJs(pdfBuffer) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 32) return 1;
  const str = pdfBuffer.toString('latin1');
  const pageMatches = str.match(/\/Type\s*\/Page\b(?!s)/g);
  const structCount = pageMatches ? pageMatches.length : 0;
  return Math.max(1, structCount);
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
  const cleanPdf = stripBase64Header(pdfBase64);
  const pdfBuffer = Buffer.from(cleanPdf, 'base64');
  const targetPage = pageIndex || 0;

  // Fast Path 1: If the PDF is a verified image-only scanned document (0 fonts, 1 full-page JPEG per page),
  // extract the exact page JPEG directly in <5ms
  const embeddedJpegs = extractEmbeddedJpegsFromPdf(pdfBuffer);
  if (embeddedJpegs.length > targetPage && isRasterImageBuffer(embeddedJpegs[targetPage].buffer)) {
    return embeddedJpegs[targetPage].buffer;
  }

  // Path 2: Vector/digital PDF rasterization via pdfjs-dist + canvas
  try {
    const pdfjsLib = await getPdfJsLib();
    if (!pdfjsLib) throw new Error('pdfjs-dist module unavailable');
    const createCanvas = getCreateCanvas();
    if (!createCanvas) throw new Error('canvas library unavailable');

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      disableWorker: true,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(targetPage + 1);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    let outBuf;
    if (typeof canvas.toBuffer === 'function') {
      outBuf = canvas.toBuffer('image/png');
    } else if (typeof canvas.toBufferAsync === 'function') {
      outBuf = await canvas.toBufferAsync('image/png');
    } else {
      outBuf = Buffer.from(canvas.toDataURL().replace(/^data:image\/png;base64,/, ''), 'base64');
    }

    if (isRasterImageBuffer(outBuf)) {
      return outBuf;
    }
  } catch (err) {
    console.warn('[PDF Rasterization Unavailable]:', err.message);
  }

  return pdfBuffer;
}

async function cropDiagram(sourceBuffer, bbox, debugLabel = 'diag') {
  try {
    const sharp = getSharp();
    if (!sharp) return null;

    const meta = await sharp(sourceBuffer).metadata();
    const imgWidth = meta.width || 800;
    const imgHeight = meta.height || 600;

    let [v1, v2, v3, v4] = bbox.map((v) => parseFloat(v) || 0);

    if (bbox.some((v) => v > 1.0 && v <= 1000)) {
      v1 = v1 / 1000;
      v2 = v2 / 1000;
      v3 = v3 / 1000;
      v4 = v4 / 1000;
    }

    let left, top, width, height;

    if (v3 > v1 && v4 > v2) {
      const dim1_min = Math.min(v1, v3);
      const dim1_max = Math.max(v1, v3);
      const dim2_min = Math.min(v2, v4);
      const dim2_max = Math.max(v2, v4);

      if (dim1_max <= 1.0 && dim2_max <= 1.0) {
        top = Math.round(dim1_min * imgHeight);
        left = Math.round(dim2_min * imgWidth);
        height = Math.round((dim1_max - dim1_min) * imgHeight);
        width = Math.round((dim2_max - dim2_min) * imgWidth);
      } else {
        top = Math.round(dim1_min);
        left = Math.round(dim2_min);
        height = Math.round(dim1_max - dim1_min);
        width = Math.round(dim2_max - dim2_min);
      }
    } else {
      left = Math.round(v1 > 1.0 ? v1 : v1 * imgWidth);
      top = Math.round(v2 > 1.0 ? v2 : v2 * imgHeight);
      width = Math.round(v3 > 1.0 ? v3 : v3 * imgWidth);
      height = Math.round(v4 > 1.0 ? v4 : v4 * imgHeight);
    }

    if (width < 30 || height < 30) {
      console.warn(
        `[Diagram Crop Warning] BBox ${JSON.stringify(bbox)} produced tiny noise box (${width}x${height}). Expanding to safe default.`
      );
      width = Math.max(150, width);
      height = Math.max(150, height);
      left = Math.max(0, left - 40);
      top = Math.max(0, top - 40);
    }

    left = Math.max(0, Math.min(imgWidth - 20, left));
    top = Math.max(0, Math.min(imgHeight - 20, top));
    width = Math.max(40, Math.min(imgWidth - left, width));
    height = Math.max(40, Math.min(imgHeight - top, height));

    const padX = Math.max(16, Math.round(width * 0.12));
    const padY = Math.max(16, Math.round(height * 0.12));

    const finalLeft = Math.round(Math.max(0, left - padX));
    const finalTop = Math.round(Math.max(0, top - padY));
    const finalWidth = Math.round(Math.max(40, Math.min(imgWidth - finalLeft, width + padX * 2)));
    const finalHeight = Math.round(Math.max(40, Math.min(imgHeight - finalTop, height + padY * 2)));

    console.log(
      `[Diagram Crop Debug] Image size: ${imgWidth}x${imgHeight} | Raw bbox: ${JSON.stringify(
        bbox
      )} | Padded crop rect: { left: ${finalLeft}, top: ${finalTop}, width: ${finalWidth}, height: ${finalHeight} }`
    );

    const cropped = await sharp(sourceBuffer)
      .extract({ left: finalLeft, top: finalTop, width: finalWidth, height: finalHeight })
      .png()
      .toBuffer();

    if (process.env.NODE_ENV !== 'production') {
      try {
        const debugDir = path.join(__dirname, '../data');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const debugFilePath = path.join(debugDir, `debug_crop_${debugLabel}.png`);
        fs.writeFileSync(debugFilePath, cropped);
        console.log(`[Diagram Crop Debug] Saved debug crop image to: ${debugFilePath}`);
      } catch (saveErr) {
        console.warn('[Diagram Crop Debug Warning] Could not write debug crop file:', saveErr.message);
      }
    }

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
    const sharp = getSharp();

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!Array.isArray(q.diagrams) || q.diagrams.length === 0) {
        console.log(`[Diagram Crop Pipeline] Question #${i + 1} (${q.id}): 0 diagrams declared.`);
        continue;
      }

      console.log(
        `[Diagram Crop Pipeline] Question #${i + 1} (${q.id}): ${q.diagrams.length} diagram(s) declared:`,
        JSON.stringify(q.diagrams)
      );
      const diagramImages = [];

      for (const d of q.diagrams) {
        if (!d || !Array.isArray(d.bbox) || d.bbox.length !== 4) {
          console.warn(`[Diagram Crop Pipeline] Question #${i + 1}: Skipping invalid bbox metadata:`, d);
          continue;
        }

        const fileIdx =
          typeof d.sourceFileIndex === 'number' && mediaFiles[d.sourceFileIndex] ? d.sourceFileIndex : 0;
        const file = mediaFiles[fileIdx];
        if (!file) {
          console.warn(
            `[Diagram Crop Pipeline] Question #${i + 1}: Source file index ${fileIdx} not found in mediaFiles.`
          );
          continue;
        }

        const rawData = file.data || file.base64 || file.imageBase64;
        if (!rawData) {
          console.warn(
            `[Diagram Crop Pipeline] Question #${i + 1}: Empty base64 payload for file index ${fileIdx}.`
          );
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
          const diagId = d.id || `diag_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
          const dataUrl = await cropDiagram(sourceBuffer, d.bbox, `q${i + 1}_${diagId}`);
          if (dataUrl) {
            let sourcePageImage = dataUrl;
            try {
              if (!sharp) throw new Error('sharp unavailable');
              const resized = await sharp(sourceBuffer)
                .resize({ width: 1000, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 75 })
                .toBuffer();
              sourcePageImage = `data:image/jpeg;base64,${resized.toString('base64')}`;
            } catch (sErr) {
              const sourceMime =
                sourceBuffer[0] === 0xff && sourceBuffer[1] === 0xd8
                  ? 'image/jpeg'
                  : mime === 'application/pdf'
                  ? 'image/png'
                  : mime;
              sourcePageImage = `data:${sourceMime};base64,${sourceBuffer.toString('base64')}`;
            }
            diagramImages.push({ id: diagId, dataUrl, sourcePageImage });
            console.log(
              `[Diagram Crop Pipeline] Question #${i + 1}: Successfully cropped and attached image + sourcePageImage for diagram ${diagId}.`
            );
          } else {
            console.warn(
              `[Diagram Crop Pipeline] Question #${i + 1}: cropDiagram returned null for diagram ${d.id}.`
            );
          }
        } catch (err) {
          console.warn(
            `[Diagram Crop Pipeline Warning] Question #${i + 1} crop failed for diagram ${d.id}:`,
            err.message
          );
        }
      }

      q.diagramImages = diagramImages;
      q.diagramsConfirmed = false;
      console.log(
        `[Diagram Crop Pipeline] Question #${i + 1}: Attached ${diagramImages.length} cropped image(s) total.`
      );
    }
  } catch (err) {
    console.warn('[attachCroppedDiagrams soft-degrade]:', err.message);
    return questions;
  }

  return questions;
}

module.exports = {
  attachCroppedDiagrams,
  cropDiagram,
  rasterizePdfPage,
  stripBase64Header,
  getPdfJsLib,
  extractEmbeddedJpegsFromPdf,
  countPdfPagesPureJs,
  isRasterImageBuffer,
  getSharp,
};
