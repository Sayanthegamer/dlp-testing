import { describe, it, expect } from 'vitest';
import { extractCandidateFigures } from '../services/layoutExtractorService.js';
import { matchDiagramsToQuestions } from '../services/diagramMatcherService.js';
import sharp from 'sharp';

describe('Deterministic Layout & Diagram Matcher Pipeline', () => {
  it('should extract candidate figures and match them to questions deterministically', async () => {
    const imageBuffer = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 4,
        background: { r: 0, g: 128, b: 255, alpha: 1 }
      }
    }).png().toBuffer();

    const mockMediaFiles = [
      {
        data: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        mimeType: 'image/png'
      }
    ];

    // Stage 1: Deterministic layout extraction
    const candidateFigures = await extractCandidateFigures(mockMediaFiles);
    expect(candidateFigures).toBeDefined();
    expect(candidateFigures.length).toBeGreaterThan(0);

    // Stage 2: Parsed question from LLM OCR
    const mockQuestions = [
      {
        id: 'q1',
        questionText: 'Refer to the circuit shown below and find resistance.',
        type: 'short_answer_numeric'
      }
    ];

    // Stage 3: Spatial & semantic matching
    const matched = await matchDiagramsToQuestions(mockQuestions, candidateFigures, mockMediaFiles);
    expect(matched).toBeDefined();
    expect(matched[0].diagrams).toBeDefined();
    expect(matched[0].diagrams.length).toBe(1);
    expect(Array.isArray(matched[0].diagramImages)).toBe(true);
    expect(matched[0].diagramImages.length).toBe(1);
  });
});
