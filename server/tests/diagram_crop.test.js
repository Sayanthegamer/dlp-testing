import { describe, it, expect } from 'vitest';
import { attachCroppedDiagrams } from '../services/diagramCropService.js';
import sharp from 'sharp';

describe('Diagram Crop Pipeline Integration', () => {
  it('should process mediaFiles, crop bounding box, and save debug image', async () => {
    // Generate a valid 200x200 red PNG image buffer
    const imageBuffer = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    }).png().toBuffer();

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
        data: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        mimeType: 'image/png'
      }
    ];

    const processed = await attachCroppedDiagrams(mockQuestions, mockMediaFiles);
    expect(processed).toBeDefined();
    expect(processed[0].diagrams).toBeDefined();
    expect(processed[0].diagrams.length).toBe(1);
    expect(processed[0].diagramsConfirmed).toBe(false);
    expect(Array.isArray(processed[0].diagramImages)).toBe(true);
    expect(processed[0].diagramImages.length).toBe(1);
    expect(processed[0].diagramImages[0].dataUrl).toContain('data:image/png;base64,');
  });
});
