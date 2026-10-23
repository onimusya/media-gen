/**
 * Input validation utilities for media-gen-cli.
 */

import { existsSync } from 'node:fs';
import { MediaGenError } from './errors.js';

export function validateFileExists(filePath: string, label: string): void {
  if (!existsSync(filePath)) {
    throw new MediaGenError('FILE_NOT_FOUND', `${label} not found: ${filePath}`);
  }
}

export function validateRequiredOption(value: unknown, name: string): void {
  if (value === undefined || value === null || value === '') {
    throw new MediaGenError('INVALID_INPUT', `Missing required option: --${name}`);
  }
}

export function validateEnum(value: string, allowed: string[], name: string): void {
  if (!allowed.includes(value)) {
    throw new MediaGenError('INVALID_INPUT', `Invalid value for --${name}: "${value}". Allowed: ${allowed.join(', ')}`);
  }
}

export function validateSizeFormat(size: string): void {
  if (!/^\d+x\d+$/.test(size)) {
    throw new MediaGenError('INVALID_INPUT', `Invalid size format: "${size}". Expected format: WIDTHxHEIGHT (e.g., 1024x1024)`);
  }
}

/** GPT Image 2/2.5 custom dimensions must align to 16-pixel boundaries. */
export function validateImageSize(size: string | undefined, provider: string, model?: string): void {
  // Azure permits arbitrary deployment names, so apply this to its image endpoint.
  if (provider !== 'azure' && !(provider === 'openai' && (!model || /^gpt-image-2(?:[.-]|$)/.test(model)))) return;
  if (!size || size === 'auto') return;
  validateSizeFormat(size);
  const [width, height] = size.split('x').map(Number);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new MediaGenError('INVALID_INPUT', 'Image width and height must be positive integers.', { provider });
  }
  if (width % 16 !== 0 || height % 16 !== 0) {
    const aligned = (edge: number) => Math.max(16, Math.round(edge / 16) * 16);
    throw new MediaGenError('INVALID_INPUT', `Invalid size '${size}'. Width and height must both be divisible by 16.`, {
      provider,
      suggestion: `Use --size ${aligned(width)}x${aligned(height)} (nearest aligned dimensions), or --size 1536x864 for exact 16:9.`,
    });
  }
}

export function validateAspectRatio(ratio: string): void {
  if (!/^\d+:\d+$/.test(ratio)) {
    throw new MediaGenError('INVALID_INPUT', `Invalid aspect ratio: "${ratio}". Expected format: W:H (e.g., 16:9)`);
  }
}

export function validatePositiveNumber(value: number, name: string): void {
  if (typeof value !== 'number' || value <= 0 || isNaN(value)) {
    throw new MediaGenError('INVALID_INPUT', `--${name} must be a positive number`);
  }
}
