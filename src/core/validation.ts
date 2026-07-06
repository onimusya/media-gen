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
