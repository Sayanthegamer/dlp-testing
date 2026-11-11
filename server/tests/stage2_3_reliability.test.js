import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';
import app from '../index';
import vercelApp from '../../api/index';
import parseRouter from '../routes/parse';

const require = createRequire(import.meta.url);
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const {
  mapWithConcurrencySettled,
  withTimeout,
  handleParseRequest,
  MAX_CONCURRENT_CHUNKS,
} = parseRouter;

describe('Stage 2 Unified Express App Factory & Stage 3 Bounded Parsing Reliability', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('Stage 2: attaches X-Request-Id, Helmet security headers, and serves /api/health identically on server/index.js and api/index.js', async () => {
    const res1 = await request(app).get('/api/health').set('X-Request-Id', 'req_audit_stage2');
    expect(res1.status).toBe(200);
    expect(res1.headers['x-request-id']).toBe('req_audit_stage2');
    expect(res1.headers['x-content-type-options']).toBe('nosniff');
    expect(res1.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res1.body.status).toBe('ok');
    expect(res1.body.geminiModel).toBe('gemini-3.5-flash-lite');

    const res2 = await request(vercelApp).get('/api/health');
    expect(res2.status).toBe(200);
    expect(res2.headers['x-request-id']).toMatch(/^req_/);
    expect(res2.headers['x-content-type-options']).toBe('nosniff');
    expect(res2.body.geminiModel).toBe('gemini-3.5-flash-lite');
  });

  it('Stage 3: enforces MAX_CONCURRENT_CHUNKS = 2 and settles mixed outcomes in order', async () => {
    expect(MAX_CONCURRENT_CHUNKS).toBe(2);

    let activeCount = 0;
    let maxObservedConcurrency = 0;
    const items = ['c0', 'c1', 'c2', 'c3', 'c4'];

    const settled = await mapWithConcurrencySettled(items, MAX_CONCURRENT_CHUNKS, async (item, idx) => {
      activeCount += 1;
      if (activeCount > maxObservedConcurrency) {
        maxObservedConcurrency = activeCount;
      }
      await new Promise((r) => setTimeout(r, 15));
      activeCount -= 1;
      if (idx === 2) {
        throw new Error(`boom-${item}`);
      }
      return `ok-${item}`;
    });

    expect(maxObservedConcurrency).toBe(2);
    expect(settled.map((s) => s.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'rejected',
      'fulfilled',
      'fulfilled',
    ]);
    expect(settled[0].value).toBe('ok-c0');
    expect(settled[2].reason.message).toBe('boom-c2');
    expect(settled[4].value).toBe('ok-c4');
  });

  it('Stage 3: withTimeout rejects hung promises after the deadline', async () => {
    const never = new Promise(() => {});
    await expect(withTimeout(never, 20, 'Unit timeout probe')).rejects.toThrow(
      /Unit timeout probe timed out after 20ms/
    );
  });

  it('Stage 3: retries only unresolved/failed chunks on failover provider instead of re-running succeeded chunks', async () => {
    process.env.GEMINI_API_KEY = 'AIzaFakeGeminiKeyForUnitTest12345';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-FakeAnthropicKeyForUnitTest12345';

    const geminiCalls = [];
    const anthropicCalls = [];
    let geminiCallCount = 0;

    vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockImplementation((config) => {
      expect(config.model).toBe('gemini-3.5-flash-lite');
      return {
        generateContent: async () => {
          const callIndex = geminiCallCount++;
          geminiCalls.push(callIndex);
          if (callIndex === 0) {
            return {
              response: {
                text: () =>
                  JSON.stringify({
                    testTitle: 'Physics Midterm',
                    questions: [
                      {
                        id: 'q_g1',
                        questionText: 'Chunk 0 question <math>x=1</math>',
                        type: 'mcq',
                        options: ['1', '2', '3', '4'],
                        correctAnswer: 0,
                      },
                    ],
                  }),
              },
            };
          }
          throw new Error('Gemini simulated chunk failure');
        },
      };
    });

    vi.spyOn(Anthropic.Messages.prototype, 'create').mockImplementation(async () => {
      anthropicCalls.push(anthropicCalls.length);
      return {
        content: [
          {
            text: JSON.stringify({
              testTitle: 'Physics Midterm',
              questions: [
                {
                  id: 'q_a2',
                  questionText: 'Chunk 1 failover question <math>y=2</math>',
                  type: 'mcq',
                  options: ['1', '2', '3', '4'],
                  correctAnswer: 1,
                },
              ],
            }),
          },
        ],
      };
    });

    const tinyPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    const req = {
      body: {
        type: 'media',
        mediaFiles: [
          { data: tinyPngBase64, mimeType: 'image/png', pageIndex: 0 },
          { data: tinyPngBase64, mimeType: 'image/png', pageIndex: 1 },
        ],
      },
    };

    let statusCode = 200;
    let jsonPayload = null;
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        jsonPayload = body;
        return this;
      },
    };

    await handleParseRequest(req, res, 'media');

    expect(statusCode).toBe(200);
    expect(jsonPayload.success).toBe(true);
    expect(geminiCalls.length).toBe(2);
    // Chunk 0 succeeded on Gemini, so Anthropic must only be invoked ONCE (for failed chunk 1)
    expect(anthropicCalls.length).toBe(1);
    expect(jsonPayload.data.questions).toHaveLength(2);
    expect(jsonPayload.chunkStats).toEqual({
      totalChunks: 2,
      succeededChunks: 2,
      failedChunks: 0,
    });
  });
});
