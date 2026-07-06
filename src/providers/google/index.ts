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

  private sizeToAspectRatio(size: string): string {
    const [w, h] = size.split('x').map(Number);
    if (w === h) return '1:1';
    if (w > h) return '16:9';
    return '9:16';
  }
}
