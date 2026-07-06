import { describe, it, expect } from 'vitest';
import { resolveOutputPath, formatResponse } from '../src/core/output.js';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

describe('Output', () => {
  const testDir = resolve(tmpdir(), 'media-gen-output-test');

  describe('resolveOutputPath', () => {
    it('resolves with --output flag', () => {
      const result = resolveOutputPath('test.png', { output: './outputs/test.png' }, testDir);
      expect(result).toBe(resolve(testDir, 'outputs/test.png'));
    });

    it('resolves with --output-dir flag', () => {
      const result = resolveOutputPath('image.png', { outputDir: './gen' }, testDir);
      expect(result).toBe(resolve(testDir, 'gen/image.png'));
    });

    it('defaults to outputs directory', () => {
      const result = resolveOutputPath('file.png', {}, testDir);
      expect(result).toBe(resolve(testDir, 'outputs/file.png'));
    });

    it('blocks external output without flag', () => {
      expect(() => {
        resolveOutputPath('test.png', { output: '../../etc/test.png' }, testDir);
      }).toThrow('outside the project directory');
    });

    it('allows external output with flag', () => {
      // Use a path that goes outside testDir but is valid on any OS
      const externalPath = resolve(testDir, '../../external/test.png');
      const result = resolveOutputPath('test.png', {
        output: externalPath,
        allowExternalOutput: true,
      }, testDir);
      expect(result).toBe(externalPath);
    });
  });

  describe('formatResponse', () => {
    it('formats success response as JSON', () => {
      const response = { ok: true as const, type: 'image', provider: 'openai', outputFile: 'test.png', durationMs: 100 };
      const result = formatResponse(response, true);
      const parsed = JSON.parse(result);
      expect(parsed.ok).toBe(true);
      expect(parsed.type).toBe('image');
      expect(parsed.provider).toBe('openai');
    });

    it('formats error response as JSON', () => {
      const response = {
        ok: false as const,
        error: { code: 'PROVIDER_NOT_CONFIGURED' as const, message: 'Missing key', provider: 'openai' },
      };
      const result = formatResponse(response, true);
      const parsed = JSON.parse(result);
      expect(parsed.ok).toBe(false);
      expect(parsed.error.code).toBe('PROVIDER_NOT_CONFIGURED');
    });

    it('formats success as human-readable text', () => {
      const response = { ok: true as const, type: 'image', provider: 'openai', outputFile: 'out.png', durationMs: 500 };
      const result = formatResponse(response, false);
      expect(result).toContain('generated successfully');
      expect(result).toContain('openai');
    });

    it('formats error as human-readable text', () => {
      const response = {
        ok: false as const,
        error: { code: 'API_ERROR' as const, message: 'Rate limited', suggestion: 'Wait and retry' },
      };
      const result = formatResponse(response, false);
      expect(result).toContain('API_ERROR');
      expect(result).toContain('Rate limited');
      expect(result).toContain('Wait and retry');
    });
  });
});
