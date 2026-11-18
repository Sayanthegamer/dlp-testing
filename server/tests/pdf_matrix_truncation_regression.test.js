import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import {
  extractAndParseJson,
  normalizeRawOptionsAndStem,
  mergeCrossPageContinuations,
  handleParseRequest,
  isTransientProviderError,
  CHUNK_TIMEOUT_MS,
} from '../routes/parse.js';
import { repairMissingMathBackslashes } from '../services/mathSanitizerService.js';
import { extractEmbeddedJpegsFromPdf } from '../services/diagramCropService.js';

const require = createRequire(import.meta.url);
const { GoogleGenerativeAI } = require('@google/generative-ai');

describe('Scanned Matrix PDF Truncation & Cross-Page Split Regression Suite', () => {
  it('1. Preserves matrix and determinant row breaks (\\\\) when followed by letters, commands, digits, or minus signs', () => {
    const q1 = '<math>A = \\begin{bmatrix} 1 & 2 & \\alpha \\\\ 1 & 0 & 1 \\\\ 0 & 1 & 2 \\end{bmatrix}</math>';
    expect(repairMissingMathBackslashes(q1)).toContain('\\\\ 1 & 0 & 1 \\\\ 0 & 1 & 2');

    const q3 = '<math>A = \\begin{bmatrix} \\beta & \\alpha & 3 \\\\\\alpha & \\alpha & \\beta \\\\-\\beta & \\alpha & 2\\alpha \\end{bmatrix}</math>';
    const fixedQ3 = repairMissingMathBackslashes(q3);
    expect(fixedQ3).toContain('\\\\ \\alpha & \\alpha & \\beta');
    expect(fixedQ3).toContain('\\\\ -\\beta & \\alpha & 2\\alpha');

    const q13 = '<math>\\begin{vmatrix} \\alpha & b & c \\\\a & \\beta & c \\\\a & b & \\gamma \\end{vmatrix} = 0</math>';
    const fixedQ13 = repairMissingMathBackslashes(q13);
    expect(fixedQ13).toContain('\\\\ a & \\beta & c \\\\ a & b & \\gamma');
    expect(fixedQ13).not.toContain('\\a ');

    const q15 = '<math>A = \\begin{bmatrix} \\sqrt{2} & 1 \\\\-1 & \\sqrt{2} \\end{bmatrix}</math>';
    const fixedQ15 = repairMissingMathBackslashes(q15);
    expect(fixedQ15).toContain('\\\\ -1 & \\sqrt{2}');
    expect(fixedQ15).not.toContain('\\-1');
  });

  it('2. Preserves all valid multi-letter LaTeX commands inside matrices (\\operatorname, \\varepsilon, \\varphi, \\vartheta, \\exp, \\hline, \\implies, \\Re, \\Im, \\dim, \\ker)', () => {
    const complexMatrix =
      '<math>\\begin{bmatrix} \\varepsilon & \\varphi \\\\ \\vartheta & \\operatorname{adj}(A) \\\\ \\exp(x) & \\Re(z) + \\Im(z) \\end{bmatrix}</math>';
    const sanitized = repairMissingMathBackslashes(complexMatrix);
    expect(sanitized).toContain('\\varepsilon & \\varphi');
    expect(sanitized).toContain('\\\\ \\vartheta & \\operatorname{adj}(A)');
    expect(sanitized).toContain('\\\\ \\exp(x) & \\Re(z) + \\Im(z)');
    expect(sanitized).not.toContain('\\\\ varepsilon');
    expect(sanitized).not.toContain('\\\\ operatorname');
  });

  it('3. Restores single-backslash row breaks produced when JSON.parse decodes unescaped \\\\ inside matrices', () => {
    const rawJsonFromLlm = String.raw`{"testTitle":"Matrix and Determinants","questions":[{"id":"q1","questionText":"Let <math>A = \begin{bmatrix} 1 & 2 & \alpha \\ 1 & 0 & 1 \\ 0 & 1 & 2 \end{bmatrix}</math> and <math>B = \begin{vmatrix} \alpha & b & c \\a & \beta & c \\a & b & \gamma \end{vmatrix}</math>","type":"mcq","options":["36","16","1","49"],"correctAnswer":1}]}`;
    const parsed = extractAndParseJson(rawJsonFromLlm);
    expect(parsed.questions[0].questionText).toContain('\\\\ 1 & 0 & 1 \\\\ 0 & 1 & 2');
    expect(parsed.questions[0].questionText).toContain('\\\\ a & \\beta & c \\\\ a & b & \\gamma');
  });

  it('4. Never truncates question stems at matrix names ("A.", "B.") OR inline statement lists ("(a) ... (b) ...") when options[] is already populated', () => {
    const q3Stem =
      'Let <math>\\alpha\\beta \\neq 0</math> and <math>A = \\begin{bmatrix} \\beta & \\alpha & 3 \\\\ \\alpha & \\alpha & \\beta \\\\ -\\beta & \\alpha & 2\\alpha \\end{bmatrix}</math>. If <math>B</math> is the matrix of cofactors of the elements of A. Then <math>\\det(AB)</math> is equal to';
    const result = normalizeRawOptionsAndStem(q3Stem, { options: [] });
    expect(result.stem).toBe(q3Stem);
    expect(result.options).toEqual([]);

    const statementStem = 'Consider statements (a) A is symmetric (b) A is orthogonal. Which is true?';
    const existingOpts = ['Only (a)', 'Only (b)', 'Both', 'Neither'];
    const preserved = normalizeRawOptionsAndStem(statementStem, { options: existingOpts });
    expect(preserved.stem).toBe(statementStem);
    expect(preserved.options).toEqual(existingOpts);

    const statementNoOpts = normalizeRawOptionsAndStem(statementStem, { options: [] });
    expect(statementNoOpts.stem).toBe(statementStem);

    const inlineStem =
      'If the system has infinitely many solutions, then <math>\\lambda^4 - \\mu</math> is equal to (a) 51 (b) 47';
    const splitInline = normalizeRawOptionsAndStem(inlineStem, { options: [] });
    expect(splitInline.stem).toBe('If the system has infinitely many solutions, then <math>\\lambda^4 - \\mu</math> is equal to');
    expect(splitInline.options).toEqual(['51', '47']);
  });

  it('5. Stitches cross-page split questions across adjacent chunks (including 3-page chains) while NEVER merging two separate questions on the same page', () => {
    const page2BottomQ11 = {
      id: 'q11',
      questionText: 'Let <math>A</math> be a square matrix such that <math>AA^T = I</math>. Then',
      type: 'short_answer_numeric',
      options: [],
      correctAnswer: null,
      _chunkIndex: 1,
      _isFirstInChunk: false,
      _isLastInChunk: true,
    };
    const page3TopContinuation = {
      id: 'page_continuation',
      isContinuation: true,
      questionText: '<math>\\frac{1}{2} A [(A + A^T)^2 + (A - A^T)^2]</math> is equal to',
      type: 'mcq',
      options: [
        '<math>A^2 + A^T</math>',
        '<math>A^3 + A^T</math>',
        '<math>A^2 + I</math>',
        '<math>A^3 + I</math>',
      ],
      correctAnswer: 1,
      _chunkIndex: 2,
      _isFirstInChunk: true,
      _isLastInChunk: false,
    };

    const merged = mergeCrossPageContinuations([page2BottomQ11, page3TopContinuation]);
    expect(merged).toHaveLength(1);
    expect(merged[0].questionText).toBe(
      'Let <math>A</math> be a square matrix such that <math>AA^T = I</math>. Then <math>\\frac{1}{2} A [(A + A^T)^2 + (A - A^T)^2]</math> is equal to'
    );
    expect(merged[0].type).toBe('mcq');
    expect(merged[0].options).toHaveLength(4);
    expect(merged[0]._chunkIndex).toBe(2);

    const samePageNumeric = {
      id: 'q5',
      questionText: 'Find the trace of matrix <math>A^{13}</math>.',
      type: 'short_answer_numeric',
      options: [],
      correctAnswer: null,
      _chunkIndex: 0,
      _isFirstInChunk: false,
      _isLastInChunk: false,
    };
    const samePageMcq = {
      id: 'q6',
      questionText: 'Given <math>|A| = 3</math>, <math>|2A|</math> is equal to',
      type: 'mcq',
      options: ['6', '12', '24', '8'],
      correctAnswer: 2,
      _chunkIndex: 0,
      _isFirstInChunk: false,
      _isLastInChunk: true,
    };
    const samePageResult = mergeCrossPageContinuations([samePageNumeric, samePageMcq]);
    expect(samePageResult).toHaveLength(2);

    // Non-adjacent chunk merge protection (e.g. Page 2 dropped, so Page 1 Q6 precedes Page 3 continuation)
    const page1BottomQ6 = {
      id: 'q6',
      questionText: 'If the system of equations has infinitely many solutions, then \\delta^4 - \\mu is equal to:',
      type: 'mcq',
      options: ['40', '44', '36', '48'],
      correctAnswer: 1,
      _chunkIndex: 0,
      _isFirstInChunk: false,
      _isLastInChunk: true,
    };
    const nonAdjacentResult = mergeCrossPageContinuations([page1BottomQ6, page3TopContinuation]);
    expect(nonAdjacentResult).toHaveLength(2);
    expect(nonAdjacentResult[0].id).toBe('q6');
    expect(nonAdjacentResult[0].options).toHaveLength(4);
    expect(nonAdjacentResult[1].id).toBe('page_continuation');
  });

  it('6. Gates extractEmbeddedJpegsFromPdf strictly to image-only scanned PDFs (never drops text from digital PDFs with embedded diagrams, ignores /SMask, and handles nested << >>)', () => {
    const fakeJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 0x41), Buffer.from([0xff, 0xd9])]);

    const digitalPdfWithDiagram = Buffer.concat([
      Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Page /Resources << /Font << /F1 2 0 R >> >> >>\nendobj\n' +
          '2 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n' +
          `3 0 obj\n<< /Type /XObject /Subtype /Image /Width 800 /Height 800 /DecodeParms << /Columns 800 >> /Filter /DCTDecode /Length ${fakeJpeg.length} >>\nstream\n`,
        'latin1'
      ),
      fakeJpeg,
      Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1'),
    ]);
    expect(extractEmbeddedJpegsFromPdf(digitalPdfWithDiagram)).toEqual([]);

    const scannedPdfWithNestedDictAndSmask = Buffer.concat([
      Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n' +
          `2 0 obj\n<< /Type /XObject /Subtype /Image /Width 1400 /Height 2000 /SMask 3 0 R /DecodeParms << /QFactor 1 >> /Filter /DCTDecode /Length ${fakeJpeg.length} >>\nstream\n`,
        'latin1'
      ),
      fakeJpeg,
      Buffer.from(
        `\nendstream\nendobj\n3 0 obj\n<< /Type /XObject /Subtype /Image /Width 1400 /Height 2000 /Filter /DCTDecode /Length ${fakeJpeg.length} >>\nstream\n`,
        'latin1'
      ),
      fakeJpeg,
      Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1'),
    ]);
    const extracted = extractEmbeddedJpegsFromPdf(scannedPdfWithNestedDictAndSmask);
    expect(extracted).toHaveLength(1);
    expect(extracted[0].width).toBe(1400);
    expect(extracted[0].height).toBe(2000);
  });

  it('7. Keeps CHUNK_TIMEOUT_MS at 25000ms to stay safely within Vercel 60s maxDuration across 2 batches', () => {
    expect(CHUNK_TIMEOUT_MS).toBe(25000);
  });

  it('8. Balances unclosed <math> tags locally without swallowing intermediate plain English text', () => {
    const brokenMultiSpan =
      'Let <math>\\alpha \\in (0, \\infty) and <math>A = \\begin{bmatrix} 1 & 2 \\\\ 0 & 1 \\end{bmatrix}</math>. Then <math>\\det(A)</math> is';
    const repaired = repairMissingMathBackslashes(brokenMultiSpan);
    expect(repaired).toBe(
      'Let <math>\\alpha \\in (0, \\infty)</math> and <math>A = \\begin{bmatrix} 1 & 2 \\\\ 0 & 1 \\end{bmatrix}</math>. Then <math>\\det(A)</math> is'
    );
  });

  it('9. Properly escapes single-backslash LaTeX spacing (\\, \\; \\!) alongside escaped quotes in JSON', () => {
    const rawWithQuotesAndThinSpace = String.raw`{"testTitle":"T","questions":[{"id":"q1","questionText":"Matrix \"A\" has resistance <math>10\,\Omega</math>"}]}`;
    const parsed = extractAndParseJson(rawWithQuotesAndThinSpace);
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0].questionText).toContain('Matrix "A"');
    expect(parsed.questions[0].questionText).toContain('<math>10\\,\\Omega</math>');
  });

  it('10. Retries transient 503/429 high-demand errors with backoff on the same provider without breaking non-transient failover', async () => {
    expect(isTransientProviderError(new Error('503 This model is currently experiencing high demand'))).toBe(true);
    expect(isTransientProviderError(new Error('429 RESOURCE_EXHAUSTED: Rate limit reached'))).toBe(true);
    expect(isTransientProviderError(new Error('Gemini simulated chunk failure'))).toBe(false);

    const origGeminiKey = process.env.GEMINI_API_KEY;
    const origAnthropicKey = process.env.ANTHROPIC_API_KEY;
    process.env.GEMINI_API_KEY = 'AIzaFakeGeminiKeyForRetryTest12345';
    delete process.env.ANTHROPIC_API_KEY;

    let attempts = 0;
    const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockImplementation(() => ({
      generateContent: async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error('[GoogleGenerativeAI Error]: [503 Service Unavailable] This model is currently experiencing high demand.');
        }
        return {
          response: {
            text: () =>
              JSON.stringify({
                testTitle: 'Retry Recovery Paper',
                questions: [
                  {
                    id: 'q1',
                    questionText: 'Recovered after 503 <math>x = 1</math>',
                    type: 'mcq',
                    options: ['1', '2', '3', '4'],
                    correctAnswer: 0,
                  },
                ],
              }),
          },
        };
      },
    }));

    const tinyPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    let jsonPayload = null;
    const req = {
      body: {
        type: 'media',
        mediaFiles: [{ data: tinyPngBase64, mimeType: 'image/png', pageIndex: 0 }],
      },
    };
    const res = {
      status() {
        return this;
      },
      json(body) {
        jsonPayload = body;
        return this;
      },
    };

    try {
      await handleParseRequest(req, res, 'media');
      expect(attempts).toBe(2);
      expect(jsonPayload.success).toBe(true);
      expect(jsonPayload.data.questions).toHaveLength(1);
      expect(jsonPayload.chunkStats.succeededChunks).toBe(1);
    } finally {
      spy.mockRestore();
      process.env.GEMINI_API_KEY = origGeminiKey;
      if (origAnthropicKey !== undefined) process.env.ANTHROPIC_API_KEY = origAnthropicKey;
    }
  });
});
