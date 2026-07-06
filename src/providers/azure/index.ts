/**
 * Azure OpenAI provider adapter for media-gen-cli.
 * Supports: image generation, TTS, transcription, translation.
 */

import type {
  FullProvider,
  ProviderCapability,
  ValidationResult,
  ImageGenerationInput,
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
import { getMimeType } from '../../utils/mime.js';
import { readFileSync, writeFileSync, statSync } from 'node:fs';

export class AzureProvider implements FullProvider {
  id = 'azure';
  name = 'Azure OpenAI';
  capabilities: ProviderCapability[] = [
    'image-generate',
    'voice-tts',
    'audio-transcribe',
    'audio-translate',
  ];

  private getConfig() {
    const config = getProviderConfig('azure');
    if (!config?.apiKey || !config?.endpoint) {
      throw new MediaGenError('PROVIDER_NOT_CONFIGURED', 'Missing AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT', {
        provider: 'azure',
        suggestion: 'Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT in your environment.',
      });
    }
    return config;
  }

  private getHeaders(): Record<string, string> {
    const config = this.getConfig();
    return {
      'api-key': config.apiKey!,
      'Content-Type': 'application/json',
    };
  }

  private getUrl(path: string): string {
    const config = this.getConfig();
    const version = config.apiVersion || '2024-06-01';
    return `${config.endpoint}${path}?api-version=${version}`;
  }

  async validateConfig(): Promise<ValidationResult> {
    const config = getProviderConfig('azure');
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config?.apiKey) errors.push('AZURE_OPENAI_API_KEY is not set');
    if (!config?.endpoint) errors.push('AZURE_OPENAI_ENDPOINT is not set');
    if (!config?.apiVersion) warnings.push('AZURE_OPENAI_API_VERSION not set, using default');

    return { valid: errors.length === 0, errors, warnings };
  }

  async generateImage(input: ImageGenerationInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();

    log.debug({ model: input.model, prompt: input.prompt }, 'Azure image generation');

    const body: Record<string, unknown> = {
      prompt: input.prompt,
      n: input.n || 1,
      size: input.size || '1024x1024',
    };

    if (input.quality) body.quality = input.quality;
    if (input.style) body.style = input.style;

    const url = this.getUrl(`/openai/deployments/${input.model || 'dall-e-3'}/images/generations`);
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.error?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'azure' });
    }

    const data = (await response.json()) as {
      data: Array<{ b64_json?: string; url?: string }>;
    };

    const imageData = data.data[0];
    ensureParentDir(input.outputFile);

    if (imageData.b64_json) {
      writeBuffer(input.outputFile, Buffer.from(imageData.b64_json, 'base64'));
    } else if (imageData.url) {
      const imgResp = await fetch(imageData.url);
      writeBuffer(input.outputFile, Buffer.from(await imgResp.arrayBuffer()));
    }

    return {
      outputFile: input.outputFile,
      mimeType: getMimeType(input.outputFile),
      sizeBytes: statSync(input.outputFile).size,
      durationMs: Date.now() - startTime,
    };
  }

  async textToSpeech(input: TextToSpeechInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();
    log.debug({ voiceId: input.voiceId }, 'Azure TTS');

    const url = this.getUrl(`/openai/deployments/${input.model || 'tts'}/audio/speech`);
    const body = {
      model: input.model || 'tts-1',
      input: input.text,
      voice: input.voiceId,
      response_format: input.format || 'mp3',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.error?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'azure' });
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
    log.debug({ input: input.inputFile }, 'Azure transcription');

    const url = this.getUrl(`/openai/deployments/${input.model || 'whisper'}/audio/transcriptions`);
    const audioBuffer = readFileSync(input.inputFile);
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer]), 'audio.mp3');
    formData.append('response_format', 'verbose_json');
    if (input.language) formData.append('language', input.language);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': this.getConfig().apiKey! },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.error?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'azure' });
    }

    const data = (await response.json()) as { text: string };
    if (input.outputFile) {
      ensureParentDir(input.outputFile);
      writeFileSync(input.outputFile, JSON.stringify(data, null, 2), 'utf-8');
    }

    return { text: data.text, outputFile: input.outputFile, durationMs: Date.now() - startTime };
  }

  async translate(input: TranslationInput): Promise<TextResult> {
    const log = getLogger();
    const startTime = Date.now();
    log.debug({ input: input.inputFile }, 'Azure translation');

    const url = this.getUrl(`/openai/deployments/${input.model || 'whisper'}/audio/translations`);
    const audioBuffer = readFileSync(input.inputFile);
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer]), 'audio.mp3');
    formData.append('response_format', 'verbose_json');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': this.getConfig().apiKey! },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.error?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'azure' });
    }

    const data = (await response.json()) as { text: string };
    if (input.outputFile) {
      ensureParentDir(input.outputFile);
      writeFileSync(input.outputFile, JSON.stringify(data, null, 2), 'utf-8');
    }

    return { text: data.text, outputFile: input.outputFile, durationMs: Date.now() - startTime };
  }
}
