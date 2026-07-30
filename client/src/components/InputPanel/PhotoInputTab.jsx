import React, { useState } from 'react';
import { UploadCloud, Image as ImageIcon, CheckCircle, Sparkles, X } from 'lucide-react';

export default function PhotoInputTab({ onSubmitImage, isLoading }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [mediaType, setMediaType] = useState('image/jpeg');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    setMediaType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      setSelectedImage(base64Data);
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!selectedImage || isLoading) return;
    onSubmitImage(selectedImage, mediaType);
  };

  const handleClear = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  return (
    <div className="space-y-4">
      {!imagePreview ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-[#dcd2c4] hover:border-[#a86e2d] bg-[#ffffff] hover:bg-[#faf6ef] rounded-xl p-8 text-center transition-all cursor-pointer group"
        >
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="photo-upload-input"
          />
          <label htmlFor="photo-upload-input" className="cursor-pointer block">
            <div className="w-12 h-12 rounded-full bg-[#f4eee4] text-[#a86e2d] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="font-serif font-semibold text-[#2c2825] text-base mb-1">
              Upload Question Photo
            </p>
            <p className="text-xs text-[#736c62] max-w-xs mx-auto">
              Snap a photo of a textbook, paper exam, or whiteboard. JPG, PNG supported.
            </p>
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-xl border border-[#dcd2c4] bg-white p-2 flex items-center justify-center max-h-64 overflow-hidden">
            <img
              src={imagePreview}
              alt="Question preview"
              className="max-h-60 object-contain rounded-lg"
            />
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-[#2c2825] hover:bg-[#1a1816] text-[#fbf9f5] font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-[#e6cca6]" />
            <span>Transcribe Photo & Typeset Math</span>
          </button>
        </div>
      )}
    </div>
  );
}
