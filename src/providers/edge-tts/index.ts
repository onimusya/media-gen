/**
 * Microsoft Edge TTS provider adapter for media-gen-cli.
 * Free text-to-speech using Microsoft Edge's online TTS service.
 * No API key required.
 */

import type {
  FullProvider,
  ProviderCapability,
  ValidationResult,
  TextToSpeechInput,
  MediaResult,
} from '../../core/provider.js';
import { MediaGenError } from '../../core/errors.js';
import { getLogger } from '../../core/logger.js';
import { ensureParentDir } from '../../utils/fs.js';
import { getMimeType } from '../../utils/mime.js';
import { writeFileSync, statSync } from 'node:fs';

export class EdgeTTSProvider implements FullProvider {
  id = 'edge-tts';
  name = 'Microsoft Edge TTS (Free)';
  capabilities: ProviderCapability[] = ['voice-tts'];

  async validateConfig(): Promise<ValidationResult> {
    // No API key needed - Edge TTS is free
    return { valid: true, errors: [], warnings: [] };
  }

  async textToSpeech(input: TextToSpeechInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();

    // Default to a high-quality multilingual voice
    const voice = input.voiceId || 'en-US-EmmaMultilingualNeural';

    log.debug({ voice, textLength: input.text.length }, 'Edge TTS synthesis');

    try {
      const { EdgeTTS } = await import('edge-tts-universal');

      const tts = new EdgeTTS(input.text, voice, {
        rate: input.speed ? `${Math.round((input.speed - 1) * 100)}%` : undefined,
      });

      const result = await tts.synthesize();

      if (!result.audio) {
        throw new MediaGenError('API_ERROR', 'Edge TTS returned empty audio', {
          provider: 'edge-tts',
        });
      }

      const arrayBuffer = await result.audio.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        throw new MediaGenError('API_ERROR', 'Edge TTS returned empty audio', {
          provider: 'edge-tts',
        });
      }

      const buffer = Buffer.from(arrayBuffer);
      ensureParentDir(input.outputFile);
      writeFileSync(input.outputFile, buffer);

      return {
        outputFile: input.outputFile,
        mimeType: getMimeType(input.outputFile),
        sizeBytes: statSync(input.outputFile).size,
        durationMs: Date.now() - startTime,
        metadata: { voice, subtitles: result.subtitle },
      };
    } catch (err) {
      if (err instanceof MediaGenError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new MediaGenError('API_ERROR', `Edge TTS failed: ${message}`, {
        provider: 'edge-tts',
        suggestion: 'Check your internet connection. Edge TTS requires network access to Microsoft servers.',
      });
    }
  }
}
