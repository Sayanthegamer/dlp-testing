import React from 'react';
import { ImageOff } from 'lucide-react';

export default function DiagramBlock({ diagrams = [], diagramImages = [] }) {
  if (!Array.isArray(diagrams) || diagrams.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {diagrams.map((d, idx) => {
        const img = Array.isArray(diagramImages) ? diagramImages.find((i) => i && i.id === d.id) : null;
        return (
          <div key={d.id || idx} className="border border-[#dcd5c4] rounded-lg p-3 bg-[#fdfbf7] inline-block max-w-full">
            {img && img.dataUrl ? (
              <img
                src={img.dataUrl}
                alt={d.caption || 'Question figure'}
                className="max-w-full max-h-64 rounded-md object-contain"
              />
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#b8622e] p-3 bg-[#f7f4ee] rounded-md border border-[#b8622e]">
                <ImageOff className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                <span>Figure needs manual attachment</span>
              </div>
            )}
            {d.caption && (
              <p className="text-xs font-serif text-[#5e554a] mt-1.5 px-1">
                {d.caption}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
