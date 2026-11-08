import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Contact, Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function StudentCredentialCardsModal({ roster = [], onClose }) {
  const handlePrint = () => {
    window.print();
  };

  const getQrUrl = (adm, dob) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/?adm=${encodeURIComponent(adm || '')}&dob=${encodeURIComponent(dob || '')}`;
  };

  const modalContent = (
    <div className="credential-cards-portal fixed inset-0 z-50 bg-[#161513]/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="credential-modal-card bg-[#fdfbf7] border border-[#dcd5c4] rounded-2xl p-6 sm:p-8 max-w-5xl w-full shadow-xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Controls (Hidden on print) */}
        <div className="modal-controls-bar flex items-center justify-between border-b border-[#dcd5c4] pb-4 print:hidden">
          <div className="flex items-center gap-2.5 font-serif font-medium text-xl text-[#1f1b16]">
            <Contact className="w-5 h-5 text-[#5e554a]" strokeWidth={1.5} />
            <h2>Candidate hall tickets</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 h-9 rounded-lg bg-[#1f1b16] hover:bg-[#332d25] text-[#fdfbf7] text-xs font-medium transition-calm flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" strokeWidth={1.5} />
              <span>Print admit cards</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 h-9 w-9 rounded-lg text-[#5e554a] hover:bg-[#efe9df] flex items-center justify-center"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Printable Grid Area */}
        <div className="printable-cards-container font-sans">
          <div className="text-xs text-[#5e554a] mb-4 print:hidden flex items-center justify-between">
            <span>
              {roster.length === 1
                ? `Hall ticket for ${roster[0].full_name || roster[0].fullName}`
                : `${roster.length} candidate cards formatted for A4 print`}
            </span>
            <span className="text-[#5e554a] font-medium bg-[#efe9df] border border-[#dcd5c4] px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#7b7266]" strokeWidth={1.5} />
              <span>Date of birth encoded in QR</span>
            </span>
          </div>

          <div
            className={
              roster.length === 1
                ? 'max-w-sm mx-auto print:max-w-xs'
                : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-3 print:w-full'
            }
          >
            {roster.map((student, idx) => (
              <div
                key={student.id || idx}
                className="admit-card-item border border-[#1f1b16] rounded-xl p-4 bg-white relative space-y-3 break-inside-avoid print:p-3"
              >
                <div className="exam-rule-double pb-2 text-center space-y-0.5">
                  <span className="text-[11px] font-sans font-medium text-[#5e554a] block">
                    Distance Learning Assessment
                  </span>
                  <h3 className="text-sm font-serif font-medium text-[#1f1b16]">
                    Candidate Hall Ticket
                  </h3>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 font-sans">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div>
                      <span className="text-[11px] text-[#7b7266] block">Candidate</span>
                      <span className="text-sm font-serif font-medium text-[#1f1b16] truncate block">
                        {student.full_name || student.fullName}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-[#7b7266] block">Roll number</span>
                      <span className="text-xs font-mono tabular-nums font-medium text-[#1f1b16] bg-[#f7f4ee] border border-[#dcd5c4] px-2 py-0.5 rounded inline-block">
                        {student.admission_number || student.admissionNumber}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center shrink-0">
                    <div className="p-1.5 bg-white border border-[#dcd5c4] rounded-lg">
                      <QRCodeSVG
                        value={getQrUrl(student.admission_number || student.admissionNumber, student.dob)}
                        size={64}
                        level="M"
                        marginSize={1}
                      />
                    </div>
                    <span className="text-[10px] text-[#7b7266] mt-1">Scan to sign in</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-[#dcd5c4] pt-2 text-[11px] text-[#7b7266] text-center font-sans">
                  Present this card or enter your roll number on the student portal
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
