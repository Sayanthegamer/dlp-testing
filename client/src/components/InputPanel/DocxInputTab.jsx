import React, { useState } from 'react';
import { FileCode, UploadCloud, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { parseDocxFile } from '../../services/docxParserService';

export default function DocxInputTab({ onSubmitDocx, isLoading }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [docxStatus, setDocxStatus] = useState(null);
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await processDocx(file);
    }
  };

  const processDocx = async (file) => {
    setSelectedFile(file);
    setIsProcessingLocal(true);
    try {
      const parsedData = await parseDocxFile(file);
      setDocxStatus(parsedData);
    } catch (err) {
      console.error(err);
      alert('Could not parse .docx file. Make sure it is a valid Microsoft Word document.');
    } finally {
      setIsProcessingLocal(false);
    }
  };

  const handleSubmit = () => {
    if (!docxStatus || isLoading) return;
    onSubmitDocx(docxStatus);
  };

  return (
    <div className="space-y-4">
      {!selectedFile ? (
        <div className="border-2 border-dashed border-[#dcd2c4] hover:border-[#2b6cb0] bg-[#ffffff] hover:bg-[#f4f8fc] rounded-xl p-8 text-center transition-all cursor-pointer group">
          <input
            type="file"
            accept=".docx"
            onChange={handleFileChange}
            className="hidden"
            id="docx-upload-input"
          />
          <label htmlFor="docx-upload-input" className="cursor-pointer block">
            <div className="w-12 h-12 rounded-full bg-[#ebf8ff] text-[#2b6cb0] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <FileCode className="w-6 h-6" />
            </div>
            <p className="font-serif font-semibold text-[#2c2825] text-base mb-1">
              Upload Word (.docx) File
            </p>
            <p className="text-xs text-[#736c62] max-w-xs mx-auto">
              Direct XML parsing for Microsoft Word OMML native equations. Exact, 100% loss-free equation extraction.
            </p>
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-[#f0f7ff] border border-[#bee3f8] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileCode className="w-6 h-6 text-[#2b6cb0]" />
              <div>
                <p className="font-medium text-xs text-[#2b6cb0]">{selectedFile.name}</p>
                <p className="text-[11px] text-[#4a5568]">
                  Extracted {docxStatus?.mathSpans?.length || 0} OMML Math equations directly from XML
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedFile(null); setDocxStatus(null); }}
              className="text-xs text-[#718096] hover:text-[#2d3748] underline"
            >
              Change
            </button>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || isProcessingLocal}
            className="w-full py-3 px-4 rounded-xl bg-[#2c2825] hover:bg-[#1a1816] text-[#fbf9f5] font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-[#e6cca6]" />
            <span>Typeset .docx Exam Question</span>
          </button>
        </div>
      )}
    </div>
  );
}
