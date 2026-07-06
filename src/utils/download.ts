/**
 * HTTP download utility for media-gen-cli.
 */

import { writeFileSync } from 'node:fs';
import { ensureParentDir } from './fs.js';
import { getLogger } from '../core/logger.js';

export async function downloadFile(url: string, outputFile: string): Promise<number> {
  const log = getLogger();
  log.debug({ url, outputFile }, 'Downloading file');

  ensureParentDir(outputFile);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} from ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(outputFile, buffer);

  log.debug({ size: buffer.length }, 'Download complete');
  return buffer.length;
}

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchBuffer(url: string, options?: RequestInit): Promise<Buffer> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
