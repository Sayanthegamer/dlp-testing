import React from 'react';
import { ImageOff } from 'lucide-react';

export default function DiagramBlock({ diagrams = [], diagramImages = [] }) {
  if (!Array.isArray(diagrams) || diagrams.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {diagrams.map((d, idx) => {
        const img = Array.isArray(diagramImages) ? diagramImages.find((i) => i && i.id === d.id) : null;
        return (
          <div key={d.id || idx} className="border border-[#e2dacd] rounded-xl p-2.5 bg-white inline-block max-w-full shadow-xs">
            {img && img.dataUrl ? (
              <img
                src={img.dataUrl}
                alt={d.caption || 'Diagram'}
                className="max-w-full max-h-64 rounded-lg object-contain"
              />
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-800 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <ImageOff className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Diagram crop failed or requires manual re-attach</span>
              </div>
            )}
            {d.caption && (
              <p className="text-[11px] font-sans font-medium text-[#736c62] mt-1.5 px-1 truncate">
                {d.caption}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
