import React, { useState } from 'react';
import { UploadCloud, Image as ImageIcon, FileText, CheckCircle, Sparkles, X, Trash2, Plus } from 'lucide-react';

export default function PhotoInputTab({ onSubmitImage, isLoading }) {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isReading, setIsReading] = useState(false);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const processFiles = (files) => {
    setIsReading(true);
    let readCount = 0;
    const newItems = [];

    files.forEach((file) => {
      const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        newItems.push({
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: formatFileSize(file.size),
          mimeType,
          data: base64Data,
          previewUrl: mimeType.startsWith('image/') ? reader.result : null
        });

        readCount++;
        if (readCount === files.length) {
          setMediaFiles(prev => [...prev, ...newItems]);
          setIsReading(false);
        }
      };

      reader.readAsDataURL(file);
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleRemoveFile = (id) => {
    setMediaFiles(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAll = () => {
    setMediaFiles([]);
  };

  const handleSubmit = () => {
    if (mediaFiles.length === 0 || isLoading || isReading) return;
    
    // Prepare files array for backend parser
    const payload = mediaFiles.map(f => ({
      name: f.name,
      mimeType: f.mimeType,
      data: f.data
    }));

    onSubmitImage(payload);
  };

  const pdfCount = mediaFiles.filter(f => f.mimeType === 'application/pdf').length;
  const imageCount = mediaFiles.filter(f => f.mimeType.startsWith('image/')).length;

  return (
    <div className="space-y-4">
      {mediaFiles.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-[#dcd2c4] hover:border-[#a86e2d] bg-[#ffffff] hover:bg-[#faf6ef] rounded-xl p-6 sm:p-8 text-center transition-all cursor-pointer group"
        >
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple={true}
            onChange={handleFileChange}
            className="hidden"
            id="photo-upload-input"
          />
          <label htmlFor="photo-upload-input" className="cursor-pointer block">
            <div className="w-12 h-12 rounded-full bg-[#f4eee4] text-[#a86e2d] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="font-serif font-semibold text-[#2c2825] text-base mb-1">
              Upload Photos & PDFs (Multi-Page Supported)
            </p>
            <p className="text-xs text-[#736c62] max-w-sm mx-auto">
              Select multiple photos of exam paper pages or PDF documents at once. Supports JPG, PNG, and PDF files.
            </p>
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          
          {/* File Queue Count Header */}
          <div className="flex items-center justify-between px-1 text-xs text-[#5c5346] font-sans">
            <span className="font-semibold text-[#8c4a17] flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Queued {mediaFiles.length} file{mediaFiles.length > 1 ? 's' : ''} ({imageCount > 0 ? `${imageCount} photo${imageCount > 1 ? 's' : ''}` : ''}{imageCount > 0 && pdfCount > 0 ? ', ' : ''}{pdfCount > 0 ? `${pdfCount} PDF${pdfCount > 1 ? 's' : ''}` : ''})</span>
            </span>

            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-[#736c62] hover:text-[#c53030] underline font-medium"
            >
              Clear All
            </button>
          </div>

          {/* Queued Files List */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {mediaFiles.map((file) => {
              const isPdf = file.mimeType === 'application/pdf';

              return (
                <div
                  key={file.id}
                  className="bg-white border border-[#e2d8ca] rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs hover:border-[#cbbfad] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isPdf ? (
                      <div className="w-9 h-9 rounded-lg bg-red-100 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                    ) : file.previewUrl ? (
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        className="w-9 h-9 object-cover rounded-lg border border-[#e2d8ca] shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[#f0e6d8] text-[#8c4a17] flex items-center justify-center shrink-0">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#1c1b18] truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-[#786f63] mt-0.5">
                        <span className={`px-1.5 py-0.2 rounded uppercase font-bold text-[10px] ${isPdf ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
                          {isPdf ? 'PDF' : file.mimeType.split('/')[1] || 'IMAGE'}
                        </span>
                        <span>{file.size}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveFile(file.id)}
                    className="p-1.5 text-[#a0aec0] hover:text-[#c53030] hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add More Files Row */}
          <div className="flex items-center justify-between pt-1">
            <label
              htmlFor="photo-upload-input-more"
              className="cursor-pointer text-xs font-semibold text-[#8c4a17] hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add More Photos / PDFs</span>
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

          {/* Submit Action */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || isReading || mediaFiles.length === 0}
            className="btn-shimmer w-full py-3 px-4 rounded-xl bg-[#2c2825] hover:bg-[#1a1816] text-[#fbf9f5] font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-[#e6cca6]" />
            <span>
              {isReading
                ? 'Reading uploaded files...'
                : `Transcribe ${mediaFiles.length} File${mediaFiles.length > 1 ? 's' : ''} & Typeset Math`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
