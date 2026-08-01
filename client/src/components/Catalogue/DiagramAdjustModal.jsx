import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Image, Upload, Trash2, CheckCircle2, X, Crop, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

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


  // Normalized crop rectangle relative to rendered image (x, y, w, h from 0.0 to 1.0)
  const initialBbox = (currentDiagram && Array.isArray(currentDiagram.bbox) && currentDiagram.bbox.length === 4)
    ? { x: currentDiagram.bbox[0], y: currentDiagram.bbox[1], w: currentDiagram.bbox[2], h: currentDiagram.bbox[3] }
    : { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };

  const [cropRect, setCropRect] = useState(initialBbox);

  // Drag interaction state
  // dragType: null | 'new' | 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w'
  const [dragState, setDragState] = useState(null);

  const imgRef = useRef(null);

  // Generate real-time high-res canvas preview of selected crop area
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
      } catch (err) {
        console.warn('[Crop Preview Canvas Error]:', err);
      }
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
        const newRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
        setCropRect(newRect);
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

  // Start drag handler (Mouse & Touch)
  const startDrag = (e, mode) => {
    e.stopPropagation();
    if (!imgRef.current) return;

    const { clientX, clientY } = getEventCoords(e);
    const imgRect = imgRef.current.getBoundingClientRect();
    const mouseX = (clientX - imgRect.left) / imgRect.width;
    const mouseY = (clientY - imgRect.top) / imgRect.height;

    setDragState({
      mode, // 'new', 'move', 'nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'
      startX: mouseX,
      startY: mouseY,
      initialRect: { ...cropRect }
    });
  };

  // Global window mousemove & touchmove listener during active dragging
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
        x = Math.min(startX, currentX);
        y = Math.min(startY, currentY);
        w = Math.max(0.02, Math.abs(currentX - startX));
        h = Math.max(0.02, Math.abs(currentY - startY));
      } else if (mode === 'move') {
        x = Math.max(0, Math.min(1 - w, initialRect.x + dx));
        y = Math.max(0, Math.min(1 - h, initialRect.y + dy));
      } else {
        // Resize handles
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

      const nextRect = { x, y, w, h };
      setCropRect(nextRect);
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
        bbox: [cropRect.x, cropRect.y, cropRect.w, cropRect.h],
        caption: caption.trim() || 'Question Figure / Diagram'
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
    <div className="fixed inset-0 z-50 bg-[#1c1b18]/85 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF7F0] border border-[#DCD5C4] rounded-3xl p-6 sm:p-8 max-w-3xl w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2DACD] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8c4a17] text-white flex items-center justify-center shadow-md">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-xl text-[#232323]">Interactive Visual Diagram Cropper</h3>
              <p className="text-xs text-[#736c62] font-sans">
                Drag the selection box or corner handles directly on the image to fine-adjust crop borders
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

        {/* Cropper Container */}
        <div className="space-y-4">
          {sourceImageSrc ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Left 2 Cols: Main Interactive Image Display */}
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#5c5346] uppercase tracking-wider">
                    Source Photo (Drag handles to adjust):
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleResetCrop}
                      className="text-xs font-semibold text-[#8c4a17] hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Full Image</span>
                    </button>
                    <label className="cursor-pointer text-xs font-semibold text-[#736c62] hover:underline flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Replace Photo</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Relative Image Canvas Container */}
                <div className="relative border-2 border-[#DCD5C4] rounded-2xl bg-[#1c1b18] p-2 flex items-center justify-center overflow-hidden min-h-[300px] max-h-[380px] shadow-inner select-none">
                  
                  {/* Rendered Image Wrapper */}
                  <div
                    className="relative inline-block"
                    onMouseDown={(e) => startDrag(e, 'new')}
                    onTouchStart={(e) => startDrag(e, 'new')}
                  >
                    <img
                      ref={imgRef}
                      src={sourceImageSrc}
                      alt="Source for crop"
                      className="max-h-[360px] max-w-full w-auto object-contain block mx-auto pointer-events-none rounded-lg"
                    />

                    {/* Selection Overlay Box & Handles (Mapped 100% to Image Pixel Bounds) */}
                    <div
                      className="absolute border-2 border-[#8c4a17] bg-[#8c4a17]/20 cursor-move shadow-xl"
                      onMouseDown={(e) => startDrag(e, 'move')}
                      onTouchStart={(e) => startDrag(e, 'move')}
                      style={{
                        left: `${cropRect.x * 100}%`,
                        top: `${cropRect.y * 100}%`,
                        width: `${cropRect.w * 100}%`,
                        height: `${cropRect.h * 100}%`
                      }}
                    >
                      {/* Label Badge */}
                      <div className="absolute -top-6 left-0 bg-[#8c4a17] text-white text-[10px] font-mono px-2 py-0.5 rounded-md shadow-md pointer-events-none whitespace-nowrap">
                        Diagram Selection ({Math.round(cropRect.w * 100)}% × {Math.round(cropRect.h * 100)}%)
                      </div>

                      {/* 4 Corner Drag Handles */}
                      <div
                        className="w-4 h-4 bg-white border-2 border-[#8c4a17] absolute -top-2 -left-2 rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                        onMouseDown={(e) => startDrag(e, 'nw')}
                        onTouchStart={(e) => startDrag(e, 'nw')}
                      />
                      <div
                        className="w-4 h-4 bg-white border-2 border-[#8c4a17] absolute -top-2 -right-2 rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                        onMouseDown={(e) => startDrag(e, 'ne')}
                        onTouchStart={(e) => startDrag(e, 'ne')}
                      />
                      <div
                        className="w-4 h-4 bg-white border-2 border-[#8c4a17] absolute -bottom-2 -left-2 rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                        onMouseDown={(e) => startDrag(e, 'sw')}
                        onTouchStart={(e) => startDrag(e, 'sw')}
                      />
                      <div
                        className="w-4 h-4 bg-white border-2 border-[#8c4a17] absolute -bottom-2 -right-2 rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                        onMouseDown={(e) => startDrag(e, 'se')}
                        onTouchStart={(e) => startDrag(e, 'se')}
                      />

                      {/* 4 Edge Drag Handles */}
                      <div
                        className="w-4 h-4 bg-white border-2 border-[#8c4a17] absolute -top-2 left-1/2 -translate-x-1/2 rounded-full cursor-ns-resize shadow-md hover:scale-125 transition-transform"
                        onMouseDown={(e) => startDrag(e, 'n')}
                        onTouchStart={(e) => startDrag(e, 'n')}
                      />
                      <div
                        className="w-4 h-4 bg-white border-2 border-[#8c4a17] absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full cursor-ns-resize shadow-md hover:scale-125 transition-transform"
                        onMouseDown={(e) => startDrag(e, 's')}
                        onTouchStart={(e) => startDrag(e, 's')}
                      />
                      <div
                        className="w-4 h-4 bg-white border-2 border-[#8c4a17] absolute top-1/2 -translate-y-1/2 -left-2 rounded-full cursor-ew-resize shadow-md hover:scale-125 transition-transform"
                        onMouseDown={(e) => startDrag(e, 'w')}
                        onTouchStart={(e) => startDrag(e, 'w')}
                      />
                      <div
                        className="w-4 h-4 bg-white border-2 border-[#8c4a17] absolute top-1/2 -translate-y-1/2 -right-2 rounded-full cursor-ew-resize shadow-md hover:scale-125 transition-transform"
                        onMouseDown={(e) => startDrag(e, 'e')}
                        onTouchStart={(e) => startDrag(e, 'e')}
                      />
                    </div>


                  </div>
                </div>
              </div>

              {/* Right Col: Accurate Live Result Preview & Caption */}
              <div className="space-y-4 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-semibold text-[#5c5346] uppercase tracking-wider mb-2">
                    Live Extracted Crop Preview
                  </label>
                  <div className="p-3 bg-white rounded-2xl border border-[#DCD5C4] text-center shadow-xs">
                    {croppedDataUrl ? (
                      <img
                        src={croppedDataUrl}
                        alt="Cropped Live Preview"
                        className="max-h-48 max-w-full mx-auto rounded-xl object-contain border border-[#e2dacd] shadow-2xs"
                      />
                    ) : (
                      <p className="text-xs text-[#736c62] py-8">Select area to generate preview</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5c5346] mb-1.5 uppercase tracking-wider">
                    Diagram Caption / Label
                  </label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="e.g. Figure 1: Circuit Diagram"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCD5C4] bg-white font-sans text-xs text-[#232323] focus:outline-none focus:ring-2 focus:ring-[#8c4a17] shadow-inner"
                  />
                </div>
              </div>

            </div>
          ) : (
            <label className="border-2 border-dashed border-[#DCD5C4] hover:border-[#8c4a17] rounded-2xl p-12 bg-white text-center cursor-pointer transition-all block group">
              <div className="w-14 h-14 rounded-2xl bg-[#FAF7F0] text-[#8c4a17] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-xs">
                <Image className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-[#232323]">
                {isUploading ? 'Loading Image...' : 'Upload Question Photo / Page'}
              </p>
              <p className="text-xs text-[#736c62] mt-1">
                Select an image file to fine-crop your figure visually in real-time
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

        {/* Modal Action Buttons */}
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
              className="px-6 py-2.5 rounded-xl bg-[#232323] hover:bg-[#3a3a3a] text-white font-serif font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
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
