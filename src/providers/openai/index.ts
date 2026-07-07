/**
 * OpenAI provider adapter for media-gen-cli.
 * Supports: image generation, image editing, TTS, transcription, translation.
 */

import type {
  FullProvider,
  ProviderCapability,
  ValidationResult,
  ImageGenerationInput,
  ImageEditInput,
  TextToSpeechInput,
  TranscriptionInput,
  TranslationInput,
  MediaResult,
  TextResult,
} from '../../core/provider.js';
import { MediaGenError } from '../../core/errors.js';
import { getProviderConfig } from '../../core/config.js';
import { getLogger } from '../../core/logger.js';
import { writeBuffer, ensureParentDir } from '../../utils/fs.js';
import { writeFileSync, readFileSync, statSync } from 'node:fs';
import { getMimeType } from '../../utils/mime.js';

export class OpenAIProvider implements FullProvider {
  id = 'openai';
  name = 'OpenAI';
  capabilities: ProviderCapability[] = [
    'image-generate',
    'image-edit',
    'voice-tts',
    'audio-transcribe',
    'audio-translate',
  ];

  private getApiKey(): string {
    const config = getProviderConfig('openai');
    if (!config?.apiKey) {
      throw new MediaGenError('PROVIDER_NOT_CONFIGURED', 'Missing OPENAI_API_KEY', {
        provider: 'openai',
        suggestion: 'Set OPENAI_API_KEY in your environment or run media-gen config init.',
      });
    }
    return config.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.getApiKey()}`,
      'Content-Type': 'application/json',
    };
  }

  async validateConfig(): Promise<ValidationResult> {
    const config = getProviderConfig('openai');
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config?.apiKey) {
      errors.push('OPENAI_API_KEY is not set');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async generateImage(input: ImageGenerationInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();

    log.debug({ model: input.model, prompt: input.prompt }, 'OpenAI image generation');

    const body: Record<string, unknown> = {
      model: input.model || 'gpt-image-1',
      prompt: input.prompt,
      n: input.n || 1,
      size: input.size || '1024x1024',
    };

    if (input.quality) body.quality = input.quality;
    if (input.style) body.style = input.style;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.error?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'openai' });
    }

    const data = (await response.json()) as {
      data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
    };

    const imageData = data.data[0];
    ensureParentDir(input.outputFile);

    if (imageData.b64_json) {
      const buffer = Buffer.from(imageData.b64_json, 'base64');
      writeBuffer(input.outputFile, buffer);
    } else if (imageData.url) {
      const imgResponse = await fetch(imageData.url);
      const buffer = Buffer.from(await imgResponse.arrayBuffer());
      writeBuffer(input.outputFile, buffer);
    }

    const size = statSync(input.outputFile).size;
    return {
      outputFile: input.outputFile,
      mimeType: getMimeType(input.outputFile),
      sizeBytes: size,
      durationMs: Date.now() - startTime,
      metadata: { revisedPrompt: imageData.revised_prompt },
    };
  }

  async editImage(input: ImageEditInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();

    log.debug({ model: input.model, prompt: input.prompt }, 'OpenAI image edit');

    const formData = new FormData();
    const imageBuffer = readFileSync(input.image);
    formData.append('image', new Blob([imageBuffer]), 'image.png');
    formData.append('prompt', input.prompt);
    formData.append('model', input.model || 'gpt-image-1');
    if (input.size) formData.append('size', input.size);
    if (input.mask) {
      const maskBuffer = readFileSync(input.mask);
      formData.append('mask', new Blob([maskBuffer]), 'mask.png');
    }

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getApiKey()}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.error?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'openai' });
    }

    const data = (await response.json()) as {
      data: Array<{ b64_json?: string; url?: string }>;
    };

    const imageData = data.data[0];
    ensureParentDir(input.outputFile);

    if (imageData.b64_json) {
      const buffer = Buffer.from(imageData.b64_json, 'base64');
      writeBuffer(input.outputFile, buffer);
    } else if (imageData.url) {
      const imgResponse = await fetch(imageData.url);
      const buffer = Buffer.from(await imgResponse.arrayBuffer());
      writeBuffer(input.outputFile, buffer);
    }

    const size = statSync(input.outputFile).size;
    return {
      outputFile: input.outputFile,
      mimeType: getMimeType(input.outputFile),
      sizeBytes: size,
      durationMs: Date.now() - startTime,
    };
  }

  async textToSpeech(input: TextToSpeechInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();

    log.debug({ voiceId: input.voiceId, model: input.model }, 'OpenAI TTS');

    const body: Record<string, unknown> = {
      model: input.model || 'tts-1',
      input: input.text,
      voice: input.voiceId,
      response_format: input.format || 'mp3',
    };

    if (input.speed) body.speed = input.speed;
    if (input.instructions) body.instructions = input.instructions;

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.error?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'openai' });
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

  async transcribe(input: TranscriptionInput): Promise<TextResult> {
    const log = getLogger();
    const startTime = Date.now();

    log.debug({ model: input.model, input: input.inputFile }, 'OpenAI transcription');

    const audioBuffer = readFileSync(input.inputFile);
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer]), 'audio.mp3');
    formData.append('model', input.model || 'whisper-1');
    formData.append('response_format', 'verbose_json');
    if (input.language) formData.append('language', input.language);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getApiKey()}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.error?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'openai' });
    }

    const data = (await response.json()) as {
      text: string;
      segments?: Array<{ start: number; end: number; text: string }>;
    };

    if (input.outputFile) {
      ensureParentDir(input.outputFile);
      writeFileSync(input.outputFile, JSON.stringify(data, null, 2), 'utf-8');
    }

    return {
      text: data.text,
      outputFile: input.outputFile,
      segments: data.segments?.map((s) => ({ start: s.start, end: s.end, text: s.text })),
      durationMs: Date.now() - startTime,
    };
  }

  async translate(input: TranslationInput): Promise<TextResult> {
    const log = getLogger();
    const startTime = Date.now();

    log.debug({ model: input.model, input: input.inputFile }, 'OpenAI translation');

    const audioBuffer = readFileSync(input.inputFile);
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer]), 'audio.mp3');
    formData.append('model', input.model || 'whisper-1');
    formData.append('response_format', 'verbose_json');

    const response = await fetch('https://api.openai.com/v1/audio/translations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getApiKey()}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.error?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'openai' });
    }

    const data = (await response.json()) as { text: string };

    if (input.outputFile) {
      ensureParentDir(input.outputFile);
      writeFileSync(input.outputFile, JSON.stringify(data, null, 2), 'utf-8');
    }

    return {
      text: data.text,
      outputFile: input.outputFile,
      durationMs: Date.now() - startTime,
    };
  }
}
