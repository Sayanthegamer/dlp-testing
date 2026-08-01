import { describe, it, expect } from 'vitest';
import { attachCroppedDiagrams } from '../services/diagramCropService.js';

describe('Diagram Crop Pipeline Integration', () => {
  it('should process mediaFiles and preserve diagram metadata schema', async () => {
    const mockQuestions = [
      {
        id: 'q1',
        questionText: 'Circuit Diagram Question',
        diagrams: [
          { id: 'diag_1', sourceFileIndex: 0, bbox: [0.1, 0.1, 0.5, 0.5], caption: 'Circuit' }
        ]
      }
    ];

    const mockMediaFiles = [
      {
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        mimeType: 'image/png'
      }
    ];

    const processed = await attachCroppedDiagrams(mockQuestions, mockMediaFiles);
    expect(processed).toBeDefined();
    expect(processed[0].diagrams).toBeDefined();
    expect(processed[0].diagrams.length).toBe(1);
    expect(processed[0].diagramsConfirmed).toBe(false);
    expect(Array.isArray(processed[0].diagramImages)).toBe(true);
  });
});
