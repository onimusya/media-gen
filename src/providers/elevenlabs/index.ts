/**
 * ElevenLabs provider adapter for media-gen-cli.
 * Supports: TTS, voice cloning, voice isolation.
 */

import type {
  FullProvider,
  ProviderCapability,
  ValidationResult,
  TextToSpeechInput,
  VoiceCloneInput,
  VoiceCloneResult,
  AudioIsolationInput,
  MediaResult,
} from '../../core/provider.js';
import { MediaGenError } from '../../core/errors.js';
import { getProviderConfig } from '../../core/config.js';
import { getLogger } from '../../core/logger.js';
import { ensureParentDir } from '../../utils/fs.js';
import { getMimeType } from '../../utils/mime.js';
import { readFileSync, writeFileSync } from 'node:fs';

export class ElevenLabsProvider implements FullProvider {
  id = 'elevenlabs';
  name = 'ElevenLabs';
  capabilities: ProviderCapability[] = [
    'voice-tts',
    'voice-clone',
    'voice-isolate',
  ];

  private getApiKey(): string {
    const config = getProviderConfig('elevenlabs');
    if (!config?.apiKey) {
      throw new MediaGenError('PROVIDER_NOT_CONFIGURED', 'Missing ELEVENLABS_API_KEY', {
        provider: 'elevenlabs',
        suggestion: 'Set ELEVENLABS_API_KEY in your environment or run media-gen config init.',
      });
    }
    return config.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return { 'xi-api-key': this.getApiKey() };
  }

  async validateConfig(): Promise<ValidationResult> {
    const config = getProviderConfig('elevenlabs');
    const errors: string[] = [];
    if (!config?.apiKey) errors.push('ELEVENLABS_API_KEY is not set');
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  async textToSpeech(input: TextToSpeechInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();
    const model = input.model || 'eleven_multilingual_v2';

    log.debug({ voiceId: input.voiceId, model }, 'ElevenLabs TTS');

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}`;
    const body = {
      text: input.text,
      model_id: model,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.detail?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'elevenlabs' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    ensureParentDir(input.outputFile);
    writeFileSync(input.outputFile, buffer);

    return {
      outputFile: input.outputFile,
      mimeType: getMimeType(input.outputFile),
      sizeBytes: buffer.length,
      durationMs: Date.now() - startTime,
    };
  }

  async cloneVoice(input: VoiceCloneInput): Promise<VoiceCloneResult> {
    const log = getLogger();
    log.debug({ name: input.name, files: input.files.length }, 'ElevenLabs voice clone');

    const formData = new FormData();
    formData.append('name', input.name);
    if (input.description) formData.append('description', input.description);
    for (const file of input.files) {
      const buffer = readFileSync(file);
      formData.append('files', new Blob([buffer]), file.split(/[/\\]/).pop());
    }

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.detail?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'elevenlabs' });
    }

    const data = (await response.json()) as { voice_id: string };
    return { voiceId: data.voice_id, name: input.name, provider: 'elevenlabs' };
  }

  async isolateVoice(input: AudioIsolationInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();
    log.debug({ input: input.inputFile }, 'ElevenLabs voice isolation');

    const audioBuffer = readFileSync(input.inputFile);
    const formData = new FormData();
    formData.append('audio', new Blob([audioBuffer]), 'audio.mp3');

    const response = await fetch('https://api.elevenlabs.io/v1/audio-isolation', {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.detail?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'elevenlabs' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    ensureParentDir(input.outputFile);
    writeFileSync(input.outputFile, buffer);

    return {
      outputFile: input.outputFile,
      mimeType: getMimeType(input.outputFile),
      sizeBytes: buffer.length,
      durationMs: Date.now() - startTime,
    };
  }
}
