/**
 * Output manager for media-gen-cli.
 * Handles writing media files, metadata, and CLI responses.
 */

import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { MediaGenError } from './errors.js';
import { getLogger } from './logger.js';
import type { CLIResponse, SuccessResponse, ErrorResponse } from './errors.js';

export interface OutputOptions {
  output?: string;
  outputDir?: string;
  overwrite?: boolean;
  metadata?: boolean;
  json?: boolean;
  dryRun?: boolean;
  allowExternalOutput?: boolean;
}

export function resolveOutputPath(
  filename: string,
  options: OutputOptions,
  cwd?: string,
): string {
  const workDir = cwd || process.cwd();
  let outputPath: string;

  if (options.output) {
    outputPath = isAbsolute(options.output)
      ? options.output
      : resolve(workDir, options.output);
  } else if (options.outputDir) {
    const dir = isAbsolute(options.outputDir)
      ? options.outputDir
      : resolve(workDir, options.outputDir);
    outputPath = resolve(dir, filename);
  } else {
    outputPath = resolve(workDir, 'outputs', filename);
  }

  // Security: prevent writing outside project directory
  if (!options.allowExternalOutput) {
    const rel = relative(workDir, outputPath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new MediaGenError('EXTERNAL_OUTPUT_BLOCKED', `Output path "${outputPath}" is outside the project directory.`, {
        suggestion: 'Use --allow-external-output to write outside the project directory.',
      });
    }
  }

  return outputPath;
}

export function ensureOutputDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function checkOverwrite(filePath: string, overwrite?: boolean): void {
  if (existsSync(filePath) && !overwrite) {
    throw new MediaGenError('FILE_ALREADY_EXISTS', `File already exists: ${filePath}`, {
      suggestion: 'Use --overwrite to replace existing files.',
    });
  }
}

export function writeMetadata(
  outputFile: string,
  metadata: Record<string, unknown>,
): string {
  const metadataFile = outputFile.replace(/\.[^.]+$/, '.metadata.json');
  writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
  return metadataFile;
}

export function getFileSize(filePath: string): number {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

export function formatResponse(response: CLIResponse, json?: boolean): string {
  if (json) {
    return JSON.stringify(response, null, 2);
  }

  if (!response.ok) {
    const err = response as ErrorResponse;
    let msg = `Error [${err.error.code}]: ${err.error.message}`;
    if (err.error.provider) msg += ` (provider: ${err.error.provider})`;
    if (err.error.suggestion) msg += `\n  Suggestion: ${err.error.suggestion}`;
    return msg;
  }

  const success = response as SuccessResponse;
  const parts: string[] = [];
  parts.push(`✓ ${success.type} generated successfully`);
  if (success.provider) parts.push(`  Provider: ${success.provider}`);
  if (success.model) parts.push(`  Model: ${success.model}`);
  if (success.outputFile) parts.push(`  Output: ${success.outputFile}`);
  if (success.durationMs) parts.push(`  Duration: ${success.durationMs}ms`);
  if (success.jobId) parts.push(`  Job ID: ${success.jobId}`);
  return parts.join('\n');
}

export function printResponse(response: CLIResponse, json?: boolean): void {
  const formatted = formatResponse(response, json);
  if (response.ok) {
    console.log(formatted);
  } else {
    console.error(formatted);
  }
  getLogger().debug(response, 'CLI response');
}
