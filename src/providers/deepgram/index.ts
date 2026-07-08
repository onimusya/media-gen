/**
 * Deepgram provider adapter for media-gen-cli.
 * Supports: transcription, translation.
 */

import type {
  FullProvider,
  ProviderCapability,
  ValidationResult,
  TranscriptionInput,
  TranslationInput,
  TextToSpeechInput,
  TextResult,
  MediaResult,
} from '../../core/provider.js';
import { MediaGenError } from '../../core/errors.js';
import { getProviderConfig } from '../../core/config.js';
import { getLogger } from '../../core/logger.js';
import { ensureParentDir } from '../../utils/fs.js';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { getMimeType } from '../../utils/mime.js';

export class DeepgramProvider implements FullProvider {
  id = 'deepgram';
  name = 'Deepgram';
  capabilities: ProviderCapability[] = ['audio-transcribe', 'audio-translate', 'voice-tts'];

  private getApiKey(): string {
    const config = getProviderConfig('deepgram');
    if (!config?.apiKey) {
      throw new MediaGenError('PROVIDER_NOT_CONFIGURED', 'Missing DEEPGRAM_API_KEY', {
        provider: 'deepgram',
        suggestion: 'Set DEEPGRAM_API_KEY in your environment or run media-gen config init.',
      });
    }
    return config.apiKey;
  }

  async validateConfig(): Promise<ValidationResult> {
    const config = getProviderConfig('deepgram');
    const errors: string[] = [];
    if (!config?.apiKey) errors.push('DEEPGRAM_API_KEY is not set');
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  async textToSpeech(input: TextToSpeechInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();
    // Voice ID is the full model name, e.g. "aura-2-thalia-en"
    const voiceModel = input.voiceId || 'aura-2-thalia-en';

    log.debug({ voiceModel }, 'Deepgram TTS');

    const response = await fetch(
      `https://api.deepgram.com/v1/speak?model=${voiceModel}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.getApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: input.text }),
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, string>)?.err_msg || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'deepgram' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    ensureParentDir(input.outputFile);
    writeFileSync(input.outputFile, buffer);

    return {
      outputFile: input.outputFile,
      mimeType: getMimeType(input.outputFile),
      sizeBytes: statSync(input.outputFile).size,
      durationMs: Date.now() - startTime,
      metadata: { voiceModel },
    };
  }

  async transcribe(input: TranscriptionInput): Promise<TextResult> {
    const log = getLogger();
    const startTime = Date.now();
    log.debug({ input: input.inputFile, model: input.model }, 'Deepgram transcription');

    const audioBuffer = readFileSync(input.inputFile);
    const mime = getMimeType(input.inputFile);
    const model = input.model || 'nova-2';

    const params = new URLSearchParams({ model, punctuate: 'true', utterances: 'true' });
    if (input.language) params.set('language', input.language);

    const response = await fetch(
      `https://api.deepgram.com/v1/listen?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.getApiKey()}`,
          'Content-Type': mime,
        },
        body: audioBuffer,
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, string>)?.err_msg || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'deepgram' });
    }

    const data = (await response.json()) as {
      results: {
        channels: Array<{
          alternatives: Array<{
            transcript: string;
            words?: Array<{ start: number; end: number; word: string; confidence: number }>;
          }>;
        }>;
      };
    };

    const alt = data.results.channels[0]?.alternatives[0];
    const text = alt?.transcript || '';
    const segments = alt?.words?.map((w) => ({
      start: w.start,
      end: w.end,
      text: w.word,
      confidence: w.confidence,
    }));

    if (input.outputFile) {
      ensureParentDir(input.outputFile);
      writeFileSync(input.outputFile, JSON.stringify({ text, segments, raw: data }, null, 2), 'utf-8');
    }

    return { text, outputFile: input.outputFile, segments, durationMs: Date.now() - startTime };
  }

  async translate(input: TranslationInput): Promise<TextResult> {
    // Deepgram supports translation via the translate parameter
    const log = getLogger();
    const startTime = Date.now();
    log.debug({ input: input.inputFile }, 'Deepgram translation');

    const audioBuffer = readFileSync(input.inputFile);
    const mime = getMimeType(input.inputFile);
    const model = input.model || 'nova-2';

    const params = new URLSearchParams({
      model,
      punctuate: 'true',
      translate: input.targetLanguage || 'en',
    });

    const response = await fetch(
      `https://api.deepgram.com/v1/listen?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.getApiKey()}`,
          'Content-Type': mime,
        },
        body: audioBuffer,
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, string>)?.err_msg || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'deepgram' });
    }

    const data = (await response.json()) as {
      results: { channels: Array<{ alternatives: Array<{ transcript: string }> }> };
    };

    const text = data.results.channels[0]?.alternatives[0]?.transcript || '';

    if (input.outputFile) {
      ensureParentDir(input.outputFile);
      writeFileSync(input.outputFile, JSON.stringify({ text, raw: data }, null, 2), 'utf-8');
    }

    return { text, outputFile: input.outputFile, durationMs: Date.now() - startTime };
  }
}
