import React, { useState } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  Trash2,
  Plus,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';

const MAX_IMAGE_EDGE = 1800;
const COMPRESS_THRESHOLD_BYTES = 900 * 1024;
const MAX_TOTAL_BASE64_BYTES = Math.floor(3.8 * 1024 * 1024); // Headroom under Vercel 4.5 MB limit

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error(`Could not read ${file.name}`));
      }
    };
    reader.onerror = () => reject(new Error(`Failed reading ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error(`Could not read binary data of ${file.name}`));
      }
    };
    reader.onerror = () => reject(new Error(`Failed reading ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

function uint8ToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function findMatchingDictStart(str, closeDictIdx, minSearchIdx = 0) {
  let depth = 0;
  const floor = Math.max(0, minSearchIdx);
  for (let i = closeDictIdx; i >= floor; i--) {
    if (str[i] === '>' && i + 1 <= closeDictIdx + 1 && str[i + 1] === '>') {
      depth++;
      i--;
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
 * Linearly extracts embedded `/DCTDecode` JPEG page streams ONLY from genuine image-only scanned PDFs
 * (0 `/Font` / `/BaseFont` resources and exact 1:1 match between full-page JPEGs and `/Type /Page` count).
 * Digital PDFs containing text questions + embedded diagrams return `[]` so text is never lost.
 */
function extractEmbeddedJpegsFromPdfArrayBuffer(arrayBuffer) {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length < 64) return [];

    let str = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      str += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }

    if (/\/(?:BaseFont|Font)\b/.test(str)) {
      return [];
    }

    const pageMatches = str.match(/\/Type\s*\/Page\b(?!s)/g);
    const pageCount = pageMatches ? pageMatches.length : 0;
    if (pageCount === 0) return [];

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

      if (streamIdx >= 3 && str.substring(streamIdx - 3, streamIdx) === 'end') {
        cursor = streamIdx + 6;
        continue;
      }

      let dataStart = streamIdx + 6;
      if (str[dataStart] === '\r' && str[dataStart + 1] === '\n') {
        dataStart += 2;
      } else if (str[dataStart] === '\n' || str[dataStart] === '\r') {
        dataStart += 1;
      } else {
        cursor = streamIdx + 6;
        continue;
      }

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

      if (width < 500 || height < 500) {
        cursor = dataStart;
        continue;
      }

      const lenMatch = dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
      let dataEnd = -1;
      if (lenMatch) {
        const declaredLen = parseInt(lenMatch[1], 10);
        if (declaredLen > 100 && dataStart + declaredLen <= bytes.length) {
          dataEnd = dataStart + declaredLen;
        }
      }
      if (dataEnd === -1) {
        const endStreamIdx = str.indexOf('endstream', dataStart);
        if (endStreamIdx !== -1) {
          dataEnd = endStreamIdx;
          while (dataEnd > dataStart && (bytes[dataEnd - 1] === 0x0a || bytes[dataEnd - 1] === 0x0d)) {
            dataEnd--;
          }
        }
      }

      if (dataEnd > dataStart && bytes[dataStart] === 0xff && bytes[dataStart + 1] === 0xd8) {
        const slice = bytes.subarray(dataStart, dataEnd);
        const b64 = uint8ToBase64(slice);
        jpegs.push({
          base64Data: b64,
          dataUrl: `data:image/jpeg;base64,${b64}`,
          byteLength: slice.length,
        });
        cursor = dataEnd + 9;
      } else {
        cursor = dataStart;
      }
    }

    if (jpegs.length !== pageCount) {
      return [];
    }

    return jpegs;
  } catch (_) {
    return [];
  }
}

function compressRasterDataUrl(fileOrSize, dataUrl, mimeType, forceCompress = false) {
  return new Promise((resolve) => {
    if (!mimeType.startsWith('image/') || mimeType === 'image/svg+xml' || typeof Image === 'undefined') {
      resolve(null);
      return;
    }

    const byteSize = typeof fileOrSize === 'number' ? fileOrSize : fileOrSize?.size || 0;

    const img = new Image();
    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          resolve(null);
          return;
        }

        const needsResize = width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE;
        const needsCompression = forceCompress || byteSize > COMPRESS_THRESHOLD_BYTES;
        if (!needsResize && !needsCompression) {
          resolve(null);
          return;
        }

        const scale = needsResize ? Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height)) : 1;
        const targetW = Math.max(1, Math.round(width * scale));
        const targetH = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const outDataUrl = canvas.toDataURL('image/jpeg', 0.84);
        const outBase64 = outDataUrl.split(',')[1] || '';
        const origBase64 = dataUrl.split(',')[1] || '';
        if (outBase64 && (outBase64.length < origBase64.length || needsResize)) {
          resolve({
            mimeType: 'image/jpeg',
            base64Data: outBase64,
            previewUrl: outDataUrl
          });
        } else {
          resolve(null);
        }
      } catch (_) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

export default function PhotoInputTab({ onSubmitImage, isLoading }) {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isReading, setIsReading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const processFiles = async (files) => {
    setIsReading(true);
    setUploadError('');
    try {
      const nestedProcessed = await Promise.all(
        files.map(async (file) => {
          const initialMime =
            file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

          if (initialMime === 'application/pdf') {
            try {
              const arrayBuffer = await readFileAsArrayBuffer(file);
              const extractedJpegs = extractEmbeddedJpegsFromPdfArrayBuffer(arrayBuffer);
              if (extractedJpegs.length > 0) {
                const pageItems = await Promise.all(
                  extractedJpegs.map(async (pageImg, idx) => {
                    let finalMime = 'image/jpeg';
                    let finalBase64 = pageImg.base64Data;
                    let previewUrl = pageImg.dataUrl;

                    const compressed = await compressRasterDataUrl(
                      pageImg.byteLength,
                      pageImg.dataUrl,
                      'image/jpeg',
                      true
                    );
                    if (compressed) {
                      finalMime = compressed.mimeType;
                      finalBase64 = compressed.base64Data;
                      previewUrl = compressed.previewUrl;
                    }

                    const approxBinaryBytes = Math.round((finalBase64.length * 3) / 4);
                    const baseName = file.name.replace(/\.pdf$/i, '');
                    return {
                      id: `file_${Date.now()}_p${idx + 1}_${Math.random().toString(36).slice(2, 7)}`,
                      name: `${baseName} (Page ${idx + 1}/${extractedJpegs.length})`,
                      size: formatFileSize(approxBinaryBytes),
                      encodedBytes: finalBase64.length,
                      mimeType: finalMime,
                      data: finalBase64,
                      pageIndex: idx,
                      totalPages: extractedJpegs.length,
                      previewUrl,
                    };
                  })
                );
                return pageItems;
              }
            } catch (_) {}
          }

          const dataUrl = await readFileAsDataUrl(file);
          let finalMime = initialMime;
          let finalBase64 = dataUrl.split(',')[1] || '';
          let previewUrl = initialMime.startsWith('image/') ? dataUrl : null;

          const compressed = await compressRasterDataUrl(file, dataUrl, initialMime);
          if (compressed) {
            finalMime = compressed.mimeType;
            finalBase64 = compressed.base64Data;
            previewUrl = compressed.previewUrl;
          }

          const approxBinaryBytes = Math.round((finalBase64.length * 3) / 4);
          return [
            {
              id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              name: file.name,
              size: formatFileSize(approxBinaryBytes),
              encodedBytes: finalBase64.length,
              mimeType: finalMime,
              data: finalBase64,
              previewUrl,
            },
          ];
        })
      );

      const processed = nestedProcessed.flat();
      setMediaFiles((prev) => [...prev, ...processed]);
    } catch (err) {
      setUploadError(err.message || 'Could not process one or more selected files.');
    } finally {
      setIsReading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleRemoveFile = (id) => {
    setMediaFiles((prev) => prev.filter((item) => item.id !== id));
    setUploadError('');
  };

  const handleClearAll = () => {
    setMediaFiles([]);
    setUploadError('');
  };

  const totalEncodedBytes = mediaFiles.reduce(
    (sum, f) => sum + (f.encodedBytes ?? f.data?.length ?? 0),
    0
  );
  const exceedsPayloadLimit = totalEncodedBytes > MAX_TOTAL_BASE64_BYTES;

  const handleSubmit = () => {
    if (mediaFiles.length === 0 || isLoading || isReading) return;
    if (exceedsPayloadLimit) {
      setUploadError(
        `Combined upload size (${formatFileSize(totalEncodedBytes)} encoded) exceeds the 3.8 MB single-request limit. Remove a file or split large PDFs into smaller batches.`
      );
      return;
    }
    setUploadError('');
    const payload = mediaFiles.map((f) => ({
      name: f.name,
      mimeType: f.mimeType,
      data: f.data,
      pageIndex: f.pageIndex,
      totalPages: f.totalPages
    }));
    onSubmitImage(payload);
  };

  return (
    <div className="space-y-4">
      {uploadError && (
        <div className="p-3 rounded-lg bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
          <span>{uploadError}</span>
        </div>
      )}

      {exceedsPayloadLimit && !uploadError && (
        <div className="p-3 rounded-lg bg-[#fdf2f2] border border-[#dc2626] text-[#dc2626] text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
          <span>
            Queued payload is {formatFileSize(totalEncodedBytes)} (max 3.8 MB per request). Remove a file or split large PDFs before transcribing.
          </span>
        </div>
      )}

      {mediaFiles.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border border-dashed border-[#dcd5c4] hover:border-[#8c4a17] bg-[#f7f4ee] rounded-lg p-8 text-center transition-calm cursor-pointer"
        >
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple={true}
            onChange={handleFileChange}
            className="hidden"
            id="photo-upload-input"
          />
          <label htmlFor="photo-upload-input" className="cursor-pointer block space-y-2">
            <div className="w-10 h-10 rounded-lg bg-[#efe9df] text-[#5e554a] flex items-center justify-center mx-auto">
              <UploadCloud className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <p className="font-serif font-medium text-[#1f1b16] text-base">
              Upload exam photos or multi-page PDFs
            </p>
            <p className="text-xs text-[#7b7266] max-w-sm mx-auto">
              Extracts questions, mathematical formulas, and figure bounding boxes across JPG, PNG, and PDF files (large images &amp; scanned PDF pages auto-compressed)
            </p>
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#5e554a] font-sans">
            <span className="font-medium text-[#1f1b16] flex items-center gap-1.5 tabular-nums">
              <CheckCircle2 className="w-4 h-4 text-[#3f6b4a]" strokeWidth={1.5} />
              <span>
                {mediaFiles.length} {mediaFiles.length === 1 ? 'page/file' : 'pages/files'} queued ({formatFileSize(totalEncodedBytes)} / 3.8 MB)
              </span>
            </span>

            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-[#7b7266] hover:text-[#dc2626] font-medium"
            >
              Clear all
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {mediaFiles.map((file) => {
              const isPdf = file.mimeType === 'application/pdf';

              return (
                <div
                  key={file.id}
                  className="bg-[#f7f4ee] border border-[#dcd5c4] rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isPdf ? (
                      <div className="w-9 h-9 rounded-md bg-[#efe9df] border border-[#dcd5c4] text-[#5e554a] flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                    ) : file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        className="w-9 h-9 object-cover rounded-md border border-[#dcd5c4] shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-md bg-[#efe9df] text-[#5e554a] flex items-center justify-center shrink-0">
                        <ImageIcon className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#1f1b16] truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-[#7b7266] font-mono tabular-nums mt-0.5">
                        <span>{isPdf ? 'PDF' : (file.mimeType.split('/')[1] || 'Image').toUpperCase()}</span>
                        <span>•</span>
                        <span>{file.size}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveFile(file.id)}
                    className="p-1.5 text-[#7b7266] hover:text-[#dc2626] rounded-md transition-calm shrink-0"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1">
            <label
              htmlFor="photo-upload-input-more"
              className="cursor-pointer text-xs font-medium text-[#8c4a17] hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Add more files</span>
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple={true}
              onChange={handleFileChange}
              className="hidden"
              id="photo-upload-input-more"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || isReading || mediaFiles.length === 0 || exceedsPayloadLimit}
            className="w-full h-10 px-4 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-medium text-xs flex items-center justify-center gap-2 transition-calm active:scale-[0.98] disabled:opacity-50"
          >
            <span>
              {isReading
                ? 'Splitting & compressing pages...'
                : `Transcribe ${mediaFiles.length} ${mediaFiles.length === 1 ? 'page/file' : 'pages/files'}`}
            </span>
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
