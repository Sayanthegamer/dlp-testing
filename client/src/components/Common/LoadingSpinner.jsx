import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Transcribing and converting math...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-[#fbf9f5] rounded-xl border border-[#e2dacd]">
      <Loader2 className="w-8 h-8 text-[#a36520] animate-spin mb-3" />
      <p className="font-serif font-medium text-[#2c2825] text-base mb-1">{message}</p>
      <p className="text-xs text-[#736c62] max-w-xs">
        Converting math into typeset exam notation with zero LaTeX code.
      </p>
    </div>
  );
}
