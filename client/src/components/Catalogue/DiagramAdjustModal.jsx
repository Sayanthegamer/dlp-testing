import React, { useState } from 'react';
import { Image, Upload, Trash2, CheckCircle2, X, Crop, Plus, Sparkles } from 'lucide-react';

export default function DiagramAdjustModal({ question, onUpdateQuestion, onClose }) {
  const diagrams = Array.isArray(question.diagrams) ? question.diagrams : [];
  const diagramImages = Array.isArray(question.diagramImages) ? question.diagramImages : [];

  const currentDiagram = diagrams[0] || null;
  const currentImage = currentDiagram ? diagramImages.find(i => i && i.id === currentDiagram.id) : null;

  const [caption, setCaption] = useState(currentDiagram?.caption || '');
  const [imageUrl, setImageUrl] = useState(currentImage?.dataUrl || '');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (dataUrl) {
        setImageUrl(dataUrl);
      }
      setIsUploading(false);
    };
    reader.onerror = () => setIsUploading(false);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!imageUrl) {
      // If image cleared, remove diagrams
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
        bbox: currentDiagram?.bbox || [0, 0, 1, 1],
        caption: caption.trim() || 'Question Figure / Diagram'
      }
    ];

    const updatedImages = [
      {
        id: diagId,
        dataUrl: imageUrl
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
    <div className="fixed inset-0 z-50 bg-[#1c1b18]/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF7F0] border border-[#DCD5C4] rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E2DACD] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8c4a17] text-white flex items-center justify-center shadow-md">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-xl text-[#232323]">Adjust Diagram / Figure</h3>
              <p className="text-xs text-[#736c62] font-sans">
                Attach, replace, or refine figure crop for Question #{question.index !== undefined ? question.index + 1 : ''}
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

        {/* Diagram Image Preview & Upload Area */}
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-[#5c5346] uppercase tracking-wider">
            Diagram Image Preview
          </label>

          {imageUrl ? (
            <div className="relative border-2 border-dashed border-[#DCD5C4] rounded-2xl p-4 bg-white text-center group">
              <img
                src={imageUrl}
                alt="Diagram Preview"
                className="max-h-64 mx-auto rounded-xl object-contain shadow-xs"
              />
              <div className="mt-3 flex items-center justify-center gap-2">
                <label className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#f0e6d8] hover:bg-[#e4d8c5] text-[#5c5346] transition-all flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Replace Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 transition-all flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Image</span>
                </button>
              </div>
            </div>
          ) : (
            <label className="border-2 border-dashed border-[#DCD5C4] hover:border-[#8c4a17] rounded-2xl p-8 bg-white text-center cursor-pointer transition-all block group">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF7F0] text-[#8c4a17] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-xs">
                <Image className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#232323]">
                {isUploading ? 'Uploading Image...' : 'Click to Upload Diagram Image'}
              </p>
              <p className="text-xs text-[#736c62] mt-1">
                Supports PNG, JPG, WEBP diagram crops
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}

          {/* Caption Input */}
          <div>
            <label className="block text-xs font-semibold text-[#5c5346] mb-1.5 uppercase tracking-wider">
              Diagram Caption / Label
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Figure 1: Circuit Diagram or Organic Reaction"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCD5C4] bg-white font-sans text-sm text-[#232323] focus:outline-none focus:ring-2 focus:ring-[#8c4a17] shadow-inner"
            />
          </div>
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
              className="px-5 py-2.5 rounded-xl bg-[#232323] hover:bg-[#3a3a3a] text-white font-serif font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Save & Confirm Diagram</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
