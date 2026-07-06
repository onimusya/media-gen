/**
 * Filesystem utilities for media-gen-cli.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function ensureParentDir(filePath: string): void {
  ensureDir(dirname(filePath));
}

export function writeBuffer(filePath: string, data: Buffer | Uint8Array): void {
  ensureParentDir(filePath);
  writeFileSync(filePath, data);
}

export function writeText(filePath: string, content: string): void {
  ensureParentDir(filePath);
  writeFileSync(filePath, content, 'utf-8');
}

export function writeJson(filePath: string, data: unknown): void {
  ensureParentDir(filePath);
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
