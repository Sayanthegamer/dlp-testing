import React, { useState } from 'react';
import { UploadCloud, Image as ImageIcon, FileText, CheckCircle2, Trash2, Plus, ArrowRight } from 'lucide-react';

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
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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
    const payload = mediaFiles.map(f => ({
      name: f.name,
      mimeType: f.mimeType,
      data: f.data
    }));
    onSubmitImage(payload);
  };

  return (
    <div className="space-y-4">
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
              Extracts questions, mathematical formulas, and figure bounding boxes across JPG, PNG, and PDF files
            </p>
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#5e554a] font-sans">
            <span className="font-medium text-[#1f1b16] flex items-center gap-1.5 tabular-nums">
              <CheckCircle2 className="w-4 h-4 text-[#3f6b4a]" strokeWidth={1.5} />
              <span>{mediaFiles.length} {mediaFiles.length === 1 ? 'file' : 'files'} queued</span>
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
            disabled={isLoading || isReading || mediaFiles.length === 0}
            className="w-full h-10 px-4 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-medium text-xs flex items-center justify-center gap-2 transition-calm active:scale-[0.98] disabled:opacity-50"
          >
            <span>
              {isReading
                ? 'Reading files'
                : `Transcribe ${mediaFiles.length} ${mediaFiles.length === 1 ? 'file' : 'files'}`}
            </span>
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
