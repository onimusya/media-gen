/**
 * Batch processing utility for media-gen-cli.
 * Reads prompts from a file and manages sequential generation.
 *
 * Supported file formats:
 * - .txt — one prompt per line (blank lines and # comments are skipped)
 * - .json — array of objects with at minimum a "prompt" field
 * - .csv — first column is prompt (header row skipped if first cell is "prompt")
 */

import { readFileSync, existsSync } from 'node:fs';
import { extname } from 'node:path';
import { MediaGenError } from '../core/errors.js';
import { getLogger } from '../core/logger.js';

export interface BatchItem {
  prompt: string;
  output?: string;
  model?: string;
  voiceId?: string;
  [key: string]: string | undefined;
}

export interface BatchResult {
  index: number;
  prompt: string;
  ok: boolean;
  outputFile?: string;
  error?: string;
  durationMs?: number;
}

export function parseBatchFile(filePath: string): BatchItem[] {
  if (!existsSync(filePath)) {
    throw new MediaGenError('FILE_NOT_FOUND', `Batch file not found: ${filePath}`);
  }

  const ext = extname(filePath).toLowerCase();
  const content = readFileSync(filePath, 'utf-8');

  switch (ext) {
    case '.json':
      return parseJsonBatch(content, filePath);
    case '.csv':
      return parseCsvBatch(content);
    case '.txt':
    default:
      return parseTxtBatch(content);
  }
}

function parseTxtBatch(content: string): BatchItem[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((prompt) => ({ prompt }));
}

function parseJsonBatch(content: string, filePath: string): BatchItem[] {
  try {
    const data = JSON.parse(content);
    if (!Array.isArray(data)) {
      throw new Error('Expected a JSON array');
    }
    return data.map((item: Record<string, string>) => {
      if (typeof item === 'string') {
        return { prompt: item };
      }
      if (!item.prompt) {
        throw new Error('Each item must have a "prompt" field');
      }
      return item as BatchItem;
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new MediaGenError('INVALID_INPUT', `Invalid batch JSON file (${filePath}): ${msg}`);
  }
}

function parseCsvBatch(content: string): BatchItem[] {
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  // Check if first row is a header
  const firstRow = lines[0].toLowerCase();
  const startIndex = firstRow.startsWith('prompt') ? 1 : 0;

  return lines.slice(startIndex).map((line) => {
    // Simple CSV: split by first comma for prompt,output format
    const commaIdx = line.indexOf(',');
    if (commaIdx === -1) {
      return { prompt: line };
    }
    const prompt = line.substring(0, commaIdx).trim().replace(/^"|"$/g, '');
    const output = line.substring(commaIdx + 1).trim().replace(/^"|"$/g, '');
    return { prompt, ...(output && { output }) };
  });
}

export async function runBatch<T>(
  items: BatchItem[],
  runner: (item: BatchItem, index: number) => Promise<T>,
  options?: { concurrency?: number; onProgress?: (completed: number, total: number, result: BatchResult) => void },
): Promise<BatchResult[]> {
  const log = getLogger();
  const results: BatchResult[] = [];
  const total = items.length;

  log.info({ total }, 'Starting batch generation');

  // Sequential execution (concurrency reserved for future)
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const startTime = Date.now();

    try {
      const result = await runner(item, i);
      const batchResult: BatchResult = {
        index: i,
        prompt: item.prompt,
        ok: true,
        outputFile: (result as Record<string, string>)?.outputFile,
        durationMs: Date.now() - startTime,
      };
      results.push(batchResult);
      if (options?.onProgress) {
        options.onProgress(i + 1, total, batchResult);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const batchResult: BatchResult = {
        index: i,
        prompt: item.prompt,
        ok: false,
        error: message,
        durationMs: Date.now() - startTime,
      };
      results.push(batchResult);
      log.error({ index: i, prompt: item.prompt, error: message }, 'Batch item failed');
      if (options?.onProgress) {
        options.onProgress(i + 1, total, batchResult);
      }
    }
  }

  return results;
}
