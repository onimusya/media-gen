/**
 * Google provider adapter for media-gen-cli.
 * Supports: image generation (Imagen), video generation (Veo).
 * Uses the Gemini API (generativelanguage.googleapis.com/v1beta).
 */

import type {
  FullProvider,
  ProviderCapability,
  ValidationResult,
  ImageGenerationInput,
  VideoGenerationInput,
  TextToSpeechInput,
  MediaResult,
  AsyncMediaResult,
  JobStatusResult,
} from '../../core/provider.js';
import { MediaGenError } from '../../core/errors.js';
import { getProviderConfig } from '../../core/config.js';
import { getLogger } from '../../core/logger.js';
import { writeBuffer, ensureParentDir } from '../../utils/fs.js';
import { getMimeType } from '../../utils/mime.js';
import { statSync, writeFileSync } from 'node:fs';

export class GoogleProvider implements FullProvider {
  id = 'google';
  name = 'Google (Gemini / Imagen / Veo)';
  capabilities: ProviderCapability[] = [
    'image-generate',
    'video-generate',
    'voice-tts',
  ];

  private getApiKey(): string {
    const config = getProviderConfig('google');
    if (!config?.apiKey) {
      throw new MediaGenError('PROVIDER_NOT_CONFIGURED', 'Missing GOOGLE_GENERATIVE_AI_API_KEY', {
        provider: 'google',
        suggestion: 'Set GOOGLE_GENERATIVE_AI_API_KEY in your environment or run media-gen config init.',
      });
    }
    return config.apiKey;
  }

  private getBaseUrl(): string {
    return 'https://generativelanguage.googleapis.com/v1beta';
  }

  private getHeaders(): Record<string, string> {
    return {
      'x-goog-api-key': this.getApiKey(),
      'Content-Type': 'application/json',
    };
  }

  async validateConfig(): Promise<ValidationResult> {
    const config = getProviderConfig('google');
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config?.apiKey) {
      errors.push('GOOGLE_GENERATIVE_AI_API_KEY is not set');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async generateImage(input: ImageGenerationInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();
    const model = input.model || 'imagen-3.0-generate-002';

    log.debug({ model, prompt: input.prompt }, 'Google image generation');

    const url = `${this.getBaseUrl()}/models/${model}:predict`;

    const body = {
      instances: [{ prompt: input.prompt }],
      parameters: {
        sampleCount: input.n || 1,
        ...(input.size && { aspectRatio: this.sizeToAspectRatio(input.size) }),
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.error?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'google' });
    }

    const data = (await response.json()) as {
      predictions: Array<{ bytesBase64Encoded: string; mimeType: string }>;
    };

    const imageData = data.predictions[0];
    const buffer = Buffer.from(imageData.bytesBase64Encoded, 'base64');
    ensureParentDir(input.outputFile);
    writeBuffer(input.outputFile, buffer);

    return {
      outputFile: input.outputFile,
      mimeType: imageData.mimeType || getMimeType(input.outputFile),
      sizeBytes: statSync(input.outputFile).size,
      durationMs: Date.now() - startTime,
    };
  }

  async generateVideo(input: VideoGenerationInput): Promise<AsyncMediaResult> {
    const log = getLogger();
    const model = input.model || 'veo-3.1-generate-preview';

    log.debug({ model, prompt: input.prompt }, 'Google video generation');

    const url = `${this.getBaseUrl()}/models/${model}:predictLongRunning`;

    const body: Record<string, unknown> = {
      instances: [{ prompt: input.prompt }],
      parameters: {
        ...(input.duration && { durationSeconds: input.duration }),
        ...(input.aspectRatio && { aspectRatio: input.aspectRatio }),
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.error?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'google' });
    }

    const data = (await response.json()) as { name: string };

    // The 'name' field contains the full operation path, e.g. "operations/xyz123"
    return {
      jobId: data.name,
      provider: 'google',
      status: 'processing',
    };
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    // jobId is the full operation path returned by predictLongRunning (e.g. "operations/xyz")
    const url = `${this.getBaseUrl()}/${jobId}`;
    const response = await fetch(url, {
      headers: { 'x-goog-api-key': this.getApiKey() },
    });

    if (!response.ok) {
      throw new MediaGenError('API_ERROR', `Failed to get job status: HTTP ${response.status}`, {
        provider: 'google',
      });
    }

    const data = (await response.json()) as {
      done?: boolean;
      error?: { message: string };
      response?: {
        generateVideoResponse?: {
          generatedSamples?: Array<{ video?: { uri: string } }>;
        };
      };
    };

    if (data.error) {
      return { jobId, provider: 'google', status: 'failed', error: data.error.message };
    }

    if (data.done) {
      return { jobId, provider: 'google', status: 'completed' };
    }

    return { jobId, provider: 'google', status: 'processing' };
  }

  async downloadJob(jobId: string, outputFile: string): Promise<MediaResult> {
    const startTime = Date.now();

    // Fetch the operation to get the video URI
    const url = `${this.getBaseUrl()}/${jobId}`;
    const response = await fetch(url, {
      headers: { 'x-goog-api-key': this.getApiKey() },
    });

    if (!response.ok) {
      throw new MediaGenError('API_ERROR', `Failed to get job result: HTTP ${response.status}`, {
        provider: 'google',
      });
    }

    const data = (await response.json()) as {
      done?: boolean;
      response?: {
        generateVideoResponse?: {
          generatedSamples?: Array<{ video?: { uri: string } }>;
        };
      };
    };

    if (!data.done || !data.response?.generateVideoResponse?.generatedSamples?.length) {
      throw new MediaGenError('JOB_FAILED', 'Job not yet completed or no video generated', { provider: 'google' });
    }

    const videoUri = data.response.generateVideoResponse.generatedSamples[0].video?.uri;
    if (!videoUri) {
      throw new MediaGenError('JOB_FAILED', 'No video URI in response', { provider: 'google' });
    }

    // Download the video using the URI with API key header
    const videoResponse = await fetch(videoUri, {
      headers: { 'x-goog-api-key': this.getApiKey() },
      redirect: 'follow',
    });

    if (!videoResponse.ok) {
      throw new MediaGenError('API_ERROR', `Failed to download video: HTTP ${videoResponse.status}`, {
        provider: 'google',
      });
    }

    const buffer = Buffer.from(await videoResponse.arrayBuffer());
    ensureParentDir(outputFile);
    writeFileSync(outputFile, buffer);

    return {
      outputFile,
      mimeType: getMimeType(outputFile),
      sizeBytes: buffer.length,
      durationMs: Date.now() - startTime,
    };
  }

  async textToSpeech(input: TextToSpeechInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();
    const model = input.model || 'gemini-3.1-flash-tts-preview';
    const voice = input.voiceId || 'Kore';

    log.debug({ model, voice }, 'Google Gemini TTS');

    const url = `${this.getBaseUrl()}/interactions`;
    const body = {
      model,
      input: input.text,
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [{ voice }],
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.error?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'google' });
    }

    const data = (await response.json()) as {
      output_audio?: { data: string };
    };

    if (!data.output_audio?.data) {
      throw new MediaGenError('API_ERROR', 'No audio data in response', { provider: 'google' });
    }

    // Output is base64-encoded PCM (24kHz, 16-bit, mono)
    // Convert to WAV format
    const pcmBuffer = Buffer.from(data.output_audio.data, 'base64');
    const wavBuffer = this.pcmToWav(pcmBuffer, 24000, 1, 16);

    ensureParentDir(input.outputFile);
    writeFileSync(input.outputFile, wavBuffer);

    return {
      outputFile: input.outputFile,
      mimeType: getMimeType(input.outputFile),
      sizeBytes: wavBuffer.length,
      durationMs: Date.now() - startTime,
      metadata: { voice, model },
    };
  }

  private pcmToWav(pcmData: Buffer, sampleRate: number, channels: number, bitDepth: number): Buffer {
    const byteRate = sampleRate * channels * (bitDepth / 8);
    const blockAlign = channels * (bitDepth / 8);
    const headerSize = 44;
    const dataSize = pcmData.length;
    const buffer = Buffer.alloc(headerSize + dataSize);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // sub-chunk size
    buffer.writeUInt16LE(1, 20); // PCM format
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitDepth, 34);

    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    pcmData.copy(buffer, 44);

    return buffer;
  }

  private sizeToAspectRatio(size: string): string {
    const [w, h] = size.split('x').map(Number);
    if (w === h) return '1:1';
    if (w > h) return '16:9';
    return '9:16';
  }
}
