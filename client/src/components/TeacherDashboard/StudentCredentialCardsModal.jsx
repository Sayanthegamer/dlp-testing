import React from 'react';
import { Printer, X, Contact, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function StudentCredentialCardsModal({ roster = [], onClose }) {
  const handlePrint = () => {
    window.print();
  };

  const getQrUrl = (adm, dob) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/?adm=${encodeURIComponent(adm || '')}&dob=${encodeURIComponent(dob || '')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1c1b18]/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-[#fefcf8] border border-[#e2d8ca] rounded-3xl p-6 sm:p-8 max-w-5xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:bg-white print:p-0">
        
        {/* Modal Controls (Hidden during print) */}
        <div className="flex items-center justify-between border-b border-[#e2d8ca] pb-4 print:hidden">
          <div className="flex items-center gap-2 font-serif font-bold text-xl text-[#2c2825]">
            <Contact className="w-6 h-6 text-[#8c4a17]" />
            <h2>WYSIWYG Student Credential Admit Cards</h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-[#8c4a17] hover:bg-[#733b11] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Admit Cards Now</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#736c62] hover:bg-[#f0e6d8] font-bold text-xs"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Grid Area */}
        <div className="print:m-0">
          <div className="text-xs text-[#736c62] font-sans mb-4 print:hidden">
            Showing {roster.length} student card(s). The layout is optimized as a 3×3 grid per A4 page for physical printing.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-3 print:w-full">
            {roster.map((student, idx) => (
              <div
                key={student.id || idx}
                className="border-2 border-[#1c1b18] rounded-2xl p-4 bg-white relative space-y-3 shadow-xs break-inside-avoid print:rounded-xl print:p-3"
              >
                {/* Card Header */}
                <div className="border-b-2 border-[#1c1b18] pb-2 text-center space-y-0.5">
                  <span className="text-[10px] font-sans font-extrabold uppercase tracking-widest text-[#8c4a17] block">
                    DISTANCE LEARNING PROGRAM (DLP)
                  </span>
                  <h3 className="text-xs font-serif font-bold text-[#1c1b18] tracking-tight">
                    COACHING TEST CANDIDATE CARD
                  </h3>
                </div>

                {/* Card Body */}
                <div className="flex items-start justify-between gap-2 pt-1 font-sans">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-[#736c62] block">CANDIDATE NAME</span>
                      <span className="text-sm font-serif font-bold text-[#1c1b18] truncate block">
                        {student.full_name || student.fullName}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-[#736c62] block">ADMISSION / ROLL NO.</span>
                      <span className="text-xs font-mono font-bold text-[#8c4a17]">
                        {student.admission_number || student.admissionNumber}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-[#736c62] block">DATE OF BIRTH (LOGIN KEY)</span>
                      <span className="text-xs font-mono font-semibold text-[#2c2825]">
                        {student.dob}
                      </span>
                    </div>
                  </div>

                  {/* Real Scannable QR Code */}
                  <div className="flex flex-col items-center justify-center shrink-0">
                    <div className="p-1 bg-white border border-[#1c1b18] rounded-xl shadow-2xs">
                      <QRCodeSVG
                        value={getQrUrl(student.admission_number || student.admissionNumber, student.dob)}
                        size={56}
                        level="M"
                        marginSize={1}
                      />
                    </div>
                    <span className="text-[8px] font-bold text-[#8c4a17] tracking-tighter mt-1 uppercase">Scan to Login</span>
                  </div>
                </div>

                {/* Footer instructions */}
                <div className="border-t border-dashed border-gray-400 pt-2 text-[9px] text-[#736c62] leading-tight text-center font-sans">
                  Keep this card safe. Use Admission # and DOB to log into the CBT portal.
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
