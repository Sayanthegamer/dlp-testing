import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Typesetting math expressions' }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center bg-[#fdfbf7] rounded-xl border border-[#dcd5c4]">
      <Loader2 className="w-6 h-6 text-[#8c4a17] animate-spin-fast mb-3" strokeWidth={1.5} />
      <p className="font-serif font-medium text-[#1f1b16] text-base mb-1">{message}</p>
      <p className="text-xs text-[#7b7266] max-w-xs">
        Converting questions into typeset exam notation
      </p>
    </div>
  );
}
