import React, { useState } from 'react';
import { FileCode, ArrowRight, AlertTriangle } from 'lucide-react';
import { parseDocxFile } from '../../services/docxParserService';

export default function DocxInputTab({ onSubmitDocx, isLoading }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [docxStatus, setDocxStatus] = useState(null);
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await processDocx(file);
    }
  };

  const processDocx = async (file) => {
    setSelectedFile(file);
    setIsProcessingLocal(true);
    setLocalError('');
    try {
      const parsedData = await parseDocxFile(file);
      setDocxStatus(parsedData);
    } catch (err) {
      setLocalError('Could not read .docx file. Verify that it is a valid Microsoft Word document.');
      setSelectedFile(null);
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
      {localError && (
        <div className="p-3 rounded-lg bg-[#f7f4ee] border border-[#b8622e] text-xs text-[#1f1b16] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#b8622e] shrink-0" strokeWidth={1.5} />
          <span>{localError}</span>
        </div>
      )}

      {!selectedFile ? (
        <div className="border border-dashed border-[#dcd5c4] hover:border-[#8c4a17] bg-[#f7f4ee] rounded-lg p-8 text-center transition-calm cursor-pointer">
          <input
            type="file"
            accept=".docx"
            onChange={handleFileChange}
            className="hidden"
            id="docx-upload-input"
          />
          <label htmlFor="docx-upload-input" className="cursor-pointer block space-y-2">
            <div className="w-10 h-10 rounded-lg bg-[#efe9df] text-[#5e554a] flex items-center justify-center mx-auto">
              <FileCode className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <p className="font-serif font-medium text-[#1f1b16] text-base">
              Upload Microsoft Word (.docx) document
            </p>
            <p className="text-xs text-[#7b7266] max-w-xs mx-auto">
              Direct XML extraction of Office Math Markup Language (OMML) equations
            </p>
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-[#f7f4ee] border border-[#dcd5c4] rounded-lg p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileCode className="w-5 h-5 text-[#5e554a]" strokeWidth={1.5} />
              <div>
                <p className="font-medium text-xs text-[#1f1b16]">{selectedFile.name}</p>
                <p className="text-[11px] text-[#7b7266] font-mono tabular-nums">
                  {docxStatus?.questions?.length || 1} {docxStatus?.questions?.length === 1 ? 'question' : 'questions'} extracted
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedFile(null); setDocxStatus(null); }}
              className="text-xs text-[#5e554a] hover:text-[#1f1b16] underline"
            >
              Change file
            </button>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || isProcessingLocal}
            className="w-full h-10 px-4 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] font-medium text-xs flex items-center justify-center gap-2 transition-calm active:scale-[0.98] disabled:opacity-50"
          >
            <span>Typeset Word document</span>
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
