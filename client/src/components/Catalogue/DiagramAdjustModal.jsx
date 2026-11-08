import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Image, Upload, Trash2, CheckCircle2, X, Crop, RotateCcw } from 'lucide-react';

export default function DiagramAdjustModal({ question, onUpdateQuestion, onClose }) {
  const diagrams = Array.isArray(question.diagrams) ? question.diagrams : [];
  const diagramImages = Array.isArray(question.diagramImages) ? question.diagramImages : [];

  const currentDiagram = diagrams[0] || null;
  const currentImage = currentDiagram ? diagramImages.find(i => i && i.id === currentDiagram.id) : null;

  const initialSource = currentImage?.sourcePageImage || currentImage?.dataUrl || '';

  const [caption, setCaption] = useState(currentDiagram?.caption || '');
  const [sourceImageSrc, setSourceImageSrc] = useState(initialSource);
  const [croppedDataUrl, setCroppedDataUrl] = useState(currentImage?.dataUrl || '');
  const [isUploading, setIsUploading] = useState(false);

  const parseBboxToRect = (bbox) => {
    if (!Array.isArray(bbox) || bbox.length !== 4) {
      return { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    }

    let [v1, v2, v3, v4] = bbox.map(v => parseFloat(v) || 0);

    if (bbox.some(v => v > 1.0 && v <= 1000)) {
      v1 /= 1000; v2 /= 1000; v3 /= 1000; v4 /= 1000;
    }

    if (v3 > v1 && v4 > v2) {
      const ymin = Math.min(v1, v3);
      const ymax = Math.max(v1, v3);
      const xmin = Math.min(v2, v4);
      const xmax = Math.max(v2, v4);
      return {
        x: xmin,
        y: ymin,
        w: Math.max(0.05, Math.min(1 - xmin, xmax - xmin)),
        h: Math.max(0.05, Math.min(1 - ymin, ymax - ymin))
      };
    }

    return {
      x: Math.max(0, Math.min(0.9, v1)),
      y: Math.max(0, Math.min(0.9, v2)),
      w: Math.max(0.05, Math.min(1 - v1, v3)),
      h: Math.max(0.05, Math.min(1 - v2, v4))
    };
  };

  const initialBbox = parseBboxToRect(currentDiagram?.bbox);
  const [cropRect, setCropRect] = useState(initialBbox);
  const [dragState, setDragState] = useState(null);
  const imgRef = useRef(null);

  const updateCropPreview = useCallback((rect) => {
    if (!sourceImageSrc || !imgRef.current) return;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = sourceImageSrc;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const cropX = Math.max(0, Math.floor(rect.x * img.naturalWidth));
      const cropY = Math.max(0, Math.floor(rect.y * img.naturalHeight));
      const cropW = Math.max(1, Math.min(img.naturalWidth - cropX, Math.floor(rect.w * img.naturalWidth)));
      const cropH = Math.max(1, Math.min(img.naturalHeight - cropY, Math.floor(rect.h * img.naturalHeight)));

      canvas.width = cropW;
      canvas.height = cropH;

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      try {
        const previewUrl = canvas.toDataURL('image/png');
        setCroppedDataUrl(previewUrl);
      } catch (_) {}
    };
  }, [sourceImageSrc]);

  useEffect(() => {
    updateCropPreview(cropRect);
  }, [cropRect, updateCropPreview]);

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
        setCropRect({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
      }
      setIsUploading(false);
    };
    reader.onerror = () => setIsUploading(false);
    reader.readAsDataURL(file);
  };

  const getEventCoords = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const startDrag = (e, mode) => {
    e.stopPropagation();
    if (!imgRef.current) return;

    const { clientX, clientY } = getEventCoords(e);
    const imgRect = imgRef.current.getBoundingClientRect();
    const mouseX = (clientX - imgRect.left) / imgRect.width;
    const mouseY = (clientY - imgRect.top) / imgRect.height;

    setDragState({
      mode,
      startX: mouseX,
      startY: mouseY,
      initialRect: { ...cropRect }
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleWindowMove = (e) => {
      if (!imgRef.current) return;
      const imgRect = imgRef.current.getBoundingClientRect();

      const { clientX, clientY } = getEventCoords(e);
      const currentX = Math.max(0, Math.min(1, (clientX - imgRect.left) / imgRect.width));
      const currentY = Math.max(0, Math.min(1, (clientY - imgRect.top) / imgRect.height));

      const { mode, startX, startY, initialRect } = dragState;
      const dx = currentX - startX;
      const dy = currentY - startY;

      let { x, y, w, h } = initialRect;

      if (mode === 'new') {
        const dragDist = Math.hypot(dx, dy);
        if (dragDist < 0.02) return;

        x = Math.min(startX, currentX);
        y = Math.min(startY, currentY);
        w = Math.max(0.02, Math.abs(currentX - startX));
        h = Math.max(0.02, Math.abs(currentY - startY));
      } else if (mode === 'move') {
        x = Math.max(0, Math.min(1 - w, initialRect.x + dx));
        y = Math.max(0, Math.min(1 - h, initialRect.y + dy));
      } else {
        if (mode.includes('n')) {
          const newY = Math.min(initialRect.y + initialRect.h - 0.02, initialRect.y + dy);
          h = initialRect.y + initialRect.h - newY;
          y = newY;
        }
        if (mode.includes('s')) {
          h = Math.max(0.02, Math.min(1 - initialRect.y, initialRect.h + dy));
        }
        if (mode.includes('w')) {
          const newX = Math.min(initialRect.x + initialRect.w - 0.02, initialRect.x + dx);
          w = initialRect.x + initialRect.w - newX;
          x = newX;
        }
        if (mode.includes('e')) {
          w = Math.max(0.02, Math.min(1 - initialRect.x, initialRect.w + dx));
        }
      }

      setCropRect({ x, y, w, h });
    };

    const handleWindowEnd = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowEnd);
    window.addEventListener('touchmove', handleWindowMove, { passive: false });
    window.addEventListener('touchend', handleWindowEnd);
    return () => {
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowEnd);
      window.removeEventListener('touchmove', handleWindowMove);
      window.removeEventListener('touchend', handleWindowEnd);
    };
  }, [dragState]);

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
        bbox: [cropRect.y, cropRect.x, cropRect.y + cropRect.h, cropRect.x + cropRect.w],
        caption: caption.trim() || 'Figure'
      }
    ];

    const updatedImages = [
      {
        id: diagId,
        dataUrl: croppedDataUrl || sourceImageSrc,
        sourcePageImage: sourceImageSrc
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
    <div className="fixed inset-0 z-50 bg-[#161513]/75 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dcd5c4] px-5 py-4 shrink-0 bg-[#fdfbf7]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#efe9df] text-[#1f1b16] flex items-center justify-center shrink-0">
              <Crop className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-serif font-medium text-lg text-[#1f1b16]">Crop figure</h3>
              <p className="text-xs text-[#5e554a] font-sans hidden sm:block">
                Drag the selection rectangle or corner handles to adjust the figure boundaries
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#7b7266] hover:text-[#1f1b16] hover:bg-[#efe9df] transition-calm shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-sans">
          {sourceImageSrc ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#5e554a]">
                    Source page
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleResetCrop}
                      className="text-xs font-medium text-[#8c4a17] hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Full image</span>
                    </button>
                    <label className="cursor-pointer text-xs font-medium text-[#5e554a] hover:text-[#1f1b16] hover:underline flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Replace image</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="relative border border-[#dcd5c4] rounded-xl bg-[#161513] p-2 flex items-center justify-center overflow-hidden min-h-[260px] max-h-[360px] select-none">
                  <div
                    className="relative inline-block"
                    onMouseDown={(e) => startDrag(e, 'new')}
                    onTouchStart={(e) => startDrag(e, 'new')}
                  >
                    <img
                      ref={imgRef}
                      src={sourceImageSrc}
                      alt="Source for crop"
                      className="max-h-[340px] max-w-full w-auto object-contain block mx-auto pointer-events-none rounded-md"
                    />

                    <div
                      className="absolute border-2 border-[#8c4a17] bg-[#8c4a17]/15 cursor-move"
                      onMouseDown={(e) => startDrag(e, 'move')}
                      onTouchStart={(e) => startDrag(e, 'move')}
                      style={{
                        left: `${cropRect.x * 100}%`,
                        top: `${cropRect.y * 100}%`,
                        width: `${cropRect.w * 100}%`,
                        height: `${cropRect.h * 100}%`
                      }}
                    >
                      <div className="absolute -top-6 left-0 bg-[#1f1b16] text-[#fdfbf7] text-[10px] font-mono tabular-nums px-2 py-0.5 rounded pointer-events-none whitespace-nowrap z-10">
                        {Math.round(cropRect.w * 100)}% × {Math.round(cropRect.h * 100)}%
                      </div>

                      {['nw', 'ne', 'sw', 'se'].map((dir) => {
                        const pos = {
                          nw: '-top-1.5 -left-1.5 cursor-nwse-resize',
                          ne: '-top-1.5 -right-1.5 cursor-nesw-resize',
                          sw: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
                          se: '-bottom-1.5 -right-1.5 cursor-nwse-resize'
                        }[dir];
                        return (
                          <div
                            key={dir}
                            className={`w-3 h-3 bg-[#fdfbf7] border-2 border-[#8c4a17] absolute rounded-sm ${pos}`}
                            onMouseDown={(e) => startDrag(e, dir)}
                            onTouchStart={(e) => startDrag(e, dir)}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-medium text-[#5e554a] mb-2">
                    Cropped preview
                  </label>
                  <div className="h-44 w-full bg-[#161513] rounded-xl border border-[#dcd5c4] flex items-center justify-center overflow-hidden p-2">
                    {croppedDataUrl ? (
                      <img
                        src={croppedDataUrl}
                        alt="Cropped preview"
                        className="max-h-full max-w-full rounded-md object-contain block mx-auto"
                      />
                    ) : (
                      <p className="text-xs text-[#8a847a]">Select region</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5e554a] mb-1.5">
                    Figure caption
                  </label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Figure 1: Resistor bridge"
                    className="w-full px-3 h-9 rounded-lg border border-[#dcd5c4] bg-[#fdfbf7] font-sans text-xs text-[#1f1b16] focus:outline-none focus:border-[#8c4a17]"
                  />
                </div>
              </div>
            </div>
          ) : (
            <label className="border border-dashed border-[#dcd5c4] hover:border-[#8c4a17] rounded-xl p-10 bg-[#f7f4ee] text-center cursor-pointer transition-calm block">
              <div className="w-10 h-10 rounded-lg bg-[#efe9df] text-[#5e554a] flex items-center justify-center mx-auto mb-3">
                <Image className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <p className="text-base font-serif font-medium text-[#1f1b16]">
                {isUploading ? 'Loading image' : 'Select figure image'}
              </p>
              <p className="text-xs text-[#7b7266] mt-1">
                Upload a diagram or page scan to crop visually
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

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#dcd5c4] px-5 py-4 shrink-0 bg-[#fdfbf7]">
          {diagrams.length > 0 ? (
            <button
              type="button"
              onClick={handleRemoveDiagram}
              className="text-xs font-medium text-[#dc2626] hover:underline flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
              <span>Remove figure</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-lg text-xs font-medium text-[#5e554a] hover:bg-[#efe9df] transition-calm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!croppedDataUrl}
              className="px-5 h-9 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-sans font-medium text-xs transition-calm flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
              <span>Save crop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
