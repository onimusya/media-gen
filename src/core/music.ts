import { writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import { MediaGenError } from './errors.js';
import type { MediaResult, MusicGenerationInput } from './provider.js';
import { ensureParentDir } from '../utils/fs.js';

export function validateMusicInput(input: MusicGenerationInput, provider: string): void {
  if (!input.prompt.trim()) {
    throw new MediaGenError('INVALID_INPUT', 'A music prompt is required.', { provider });
  }
  if (extname(input.outputFile).toLowerCase() !== '.mp3') {
    throw new MediaGenError('INVALID_INPUT', 'Music output must use the .mp3 extension.', { provider });
  }
  if (input.duration !== undefined && (!Number.isFinite(input.duration) || input.duration <= 0)) {
    throw new MediaGenError('INVALID_INPUT', 'Music duration must be a positive number of seconds.', { provider });
  }
  if (provider === 'elevenlabs') {
    if (input.duration !== undefined && (input.duration < 3 || input.duration > 600)) {
      throw new MediaGenError('INVALID_INPUT', 'ElevenLabs Music duration must be between 3 and 600 seconds.', { provider });
    }
    if ([...input.prompt].length > 4100) {
      throw new MediaGenError('INVALID_INPUT', 'ElevenLabs Music prompts must be at most 4100 characters.', { provider });
    }
  }
}

export function saveMusic(input: MusicGenerationInput, audio: Buffer, provider: string, startTime: number): MediaResult {
  const { outputFile, overwrite } = input;
  const hasId3Tag = audio.toString('ascii', 0, 3) === 'ID3';
  const hasMpegFrame = audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0;
  if (audio.length < 4 || (!hasId3Tag && !hasMpegFrame)) {
    throw new MediaGenError('API_ERROR', 'The provider returned no valid MP3 data.', { provider });
  }
  ensureParentDir(outputFile);
  try {
    writeFileSync(outputFile, audio, { flag: overwrite ? 'w' : 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new MediaGenError('FILE_ALREADY_EXISTS', `File already exists: ${outputFile}`, {
        suggestion: 'Use --overwrite to replace existing files.',
      });
    }
    throw error;
  }
  return { outputFile, mimeType: 'audio/mpeg', sizeBytes: audio.length, durationMs: Date.now() - startTime };
}
