import React, { useState, useRef, useEffect } from 'react';
import { Image, Upload, Trash2, CheckCircle2, X, Crop, RotateCcw, RefreshCw } from 'lucide-react';

export default function DiagramAdjustModal({ question, onUpdateQuestion, onClose }) {
  const diagrams = Array.isArray(question.diagrams) ? question.diagrams : [];
  const diagramImages = Array.isArray(question.diagramImages) ? question.diagramImages : [];

  const currentDiagram = diagrams[0] || null;
  const currentImage = currentDiagram ? diagramImages.find(i => i && i.id === currentDiagram.id) : null;

  const [caption, setCaption] = useState(currentDiagram?.caption || '');
  const [sourceImageSrc, setSourceImageSrc] = useState(currentImage?.dataUrl || '');
  const [croppedDataUrl, setCroppedDataUrl] = useState(currentImage?.dataUrl || '');
  const [isUploading, setIsUploading] = useState(false);

  // Normalized crop rectangle: { x: float, y: float, w: float, h: float } (0.0 to 1.0)
  const initialBbox = (currentDiagram && Array.isArray(currentDiagram.bbox) && currentDiagram.bbox.length === 4)
    ? { x: currentDiagram.bbox[0], y: currentDiagram.bbox[1], w: currentDiagram.bbox[2], h: currentDiagram.bbox[3] }
    : { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };

  const [cropRect, setCropRect] = useState(initialBbox);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Generate real-time cropped canvas preview when cropRect or sourceImageSrc changes
  useEffect(() => {
    if (!sourceImageSrc) return;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = sourceImageSrc;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const cropX = Math.max(0, Math.floor(cropRect.x * img.naturalWidth));
      const cropY = Math.max(0, Math.floor(cropRect.y * img.naturalHeight));
      const cropW = Math.min(img.naturalWidth - cropX, Math.floor(cropRect.w * img.naturalWidth));
      const cropH = Math.min(img.naturalHeight - cropY, Math.floor(cropRect.h * img.naturalHeight));

      if (cropW <= 0 || cropH <= 0) return;

      canvas.width = cropW;
      canvas.height = cropH;

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      try {
        const previewUrl = canvas.toDataURL('image/png');
        setCroppedDataUrl(previewUrl);
      } catch (err) {
        console.warn('[Crop Preview Canvas Error]:', err);
      }
    };
  }, [sourceImageSrc, cropRect]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (dataUrl) {
        setSourceImageSrc(dataUrl);
        setCroppedDataUrl(dataUrl);
        setCropRect({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
      }
      setIsUploading(false);
    };
    reader.onerror = () => setIsUploading(false);
    reader.readAsDataURL(file);
  };

  // Interactive Drag-to-Crop Mouse Events
  const handleMouseDown = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / rect.width;
    const startY = (e.clientY - rect.top) / rect.height;

    setIsDragging(true);
    setDragStart({ x: startX, y: startY });
    setCropRect({ x: startX, y: startY, w: 0.01, h: 0.01 });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const x = Math.min(dragStart.x, currentX);
    const y = Math.min(dragStart.y, currentY);
    const w = Math.abs(currentX - dragStart.x);
    const h = Math.abs(currentY - dragStart.y);

    setCropRect({ x, y, w, h });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetCrop = () => {
    setCropRect({ x: 0, y: 0, w: 1, h: 1 });
  };

  const handleSave = () => {
    if (!sourceImageSrc && !croppedDataUrl) {
      onUpdateQuestion(question.id, {
        ...question,
        diagrams: [],
        diagramImages: [],
        diagramsConfirmed: false
      });
      onClose();
      return;
    }

    const diagId = currentDiagram?.id || `diag_${Date.now()}`;
    const updatedDiagrams = [
      {
        id: diagId,
        sourceFileIndex: currentDiagram?.sourceFileIndex || 0,
        pageIndex: currentDiagram?.pageIndex || 0,
        bbox: [cropRect.x, cropRect.y, cropRect.w, cropRect.h],
        caption: caption.trim() || 'Question Figure / Diagram'
      }
    ];

    const updatedImages = [
      {
        id: diagId,
        dataUrl: croppedDataUrl || sourceImageSrc
      }
    ];

    onUpdateQuestion(question.id, {
      ...question,
      diagrams: updatedDiagrams,
      diagramImages: updatedImages,
      diagramsConfirmed: true
    });
    onClose();
  };

  const handleRemoveDiagram = () => {
    onUpdateQuestion(question.id, {
      ...question,
      diagrams: [],
      diagramImages: [],
      diagramsConfirmed: false
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1c1b18]/85 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF7F0] border border-[#DCD5C4] rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E2DACD] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8c4a17] text-white flex items-center justify-center shadow-md">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-xl text-[#232323]">Interactive Diagram Cropper</h3>
              <p className="text-xs text-[#736c62] font-sans">
                Drag on the image below to adjust crop box visually in real-time
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#736c62] hover:bg-[#EDE5D8] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Canvas Drag & Crop Area */}
        <div className="space-y-4">
          {sourceImageSrc ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#5c5346] uppercase tracking-wider">
                  Drag box over diagram area:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetCrop}
                    className="text-xs font-medium text-[#8c4a17] hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Select Entire Image</span>
                  </button>
                  <label className="cursor-pointer text-xs font-medium text-[#736c62] hover:underline flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload New Photo</span>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Drag Container */}
              <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="relative border-2 border-[#DCD5C4] rounded-2xl overflow-hidden bg-[#1c1b18] select-none cursor-crosshair max-h-80 flex items-center justify-center"
              >
                <img
                  ref={imgRef}
                  src={sourceImageSrc}
                  alt="Source for cropping"
                  className="max-h-80 w-auto object-contain block mx-auto pointer-events-none"
                />

                {/* Crop Selection Rectangle Overlay */}
                <div
                  className="absolute border-2 border-[#8c4a17] bg-[#8c4a17]/20 shadow-lg transition-all"
                  style={{
                    left: `${cropRect.x * 100}%`,
                    top: `${cropRect.y * 100}%`,
                    width: `${cropRect.w * 100}%`,
                    height: `${cropRect.h * 100}%`
                  }}
                >
                  <div className="absolute top-1 left-1.5 bg-[#8c4a17] text-white text-[10px] font-mono px-1.5 py-0.5 rounded-md shadow-xs">
                    Diagram Crop
                  </div>
                  {/* Handle Corners */}
                  <div className="w-2.5 h-2.5 bg-white border border-[#8c4a17] absolute -top-1 -left-1 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-white border border-[#8c4a17] absolute -top-1 -right-1 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-white border border-[#8c4a17] absolute -bottom-1 -left-1 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-white border border-[#8c4a17] absolute -bottom-1 -right-1 rounded-full" />
                </div>
              </div>

              {/* Real-time Extracted Crop Preview */}
              {croppedDataUrl && (
                <div className="p-3 bg-white rounded-2xl border border-[#DCD5C4] flex items-center gap-4">
                  <div className="shrink-0 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8c4a17] mb-1">
                      Live Result
                    </p>
                    <img
                      src={croppedDataUrl}
                      alt="Cropped Preview"
                      className="max-h-24 max-w-32 rounded-lg object-contain border border-[#e2dacd]"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-semibold text-[#5c5346] mb-1 uppercase tracking-wider">
                      Diagram Caption / Label
                    </label>
                    <input
                      type="text"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="e.g. Figure 1: Circuit Diagram"
                      className="w-full px-3 py-2 rounded-xl border border-[#DCD5C4] font-sans text-xs text-[#232323] focus:outline-none focus:ring-2 focus:ring-[#8c4a17]"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <label className="border-2 border-dashed border-[#DCD5C4] hover:border-[#8c4a17] rounded-2xl p-10 bg-white text-center cursor-pointer transition-all block group">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF7F0] text-[#8c4a17] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-xs">
                <Image className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#232323]">
                {isUploading ? 'Loading Photo...' : 'Upload Question Photo / Page'}
              </p>
              <p className="text-xs text-[#736c62] mt-1">
                Select an image to drag-to-crop your diagram visually
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between border-t border-[#E2DACD] pt-4">
          {diagrams.length > 0 && (
            <button
              type="button"
              onClick={handleRemoveDiagram}
              className="text-xs font-semibold text-red-700 hover:text-red-800 flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Diagram</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#736c62] hover:bg-[#EDE5D8] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!croppedDataUrl}
              className="px-5 py-2.5 rounded-xl bg-[#232323] hover:bg-[#3a3a3a] text-white font-serif font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Apply Crop & Save</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
