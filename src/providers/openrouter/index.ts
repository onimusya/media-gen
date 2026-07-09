/**
 * OpenRouter provider adapter for media-gen-cli.
 * Supports: image generation via dedicated Image API.
 * OpenRouter acts as a unified gateway to multiple models.
 */

import type {
  FullProvider,
  ProviderCapability,
  ValidationResult,
  ImageGenerationInput,
  VideoGenerationInput,
  MediaResult,
  AsyncMediaResult,
} from '../../core/provider.js';
import { MediaGenError } from '../../core/errors.js';
import { getProviderConfig } from '../../core/config.js';
import { getLogger } from '../../core/logger.js';
import { ensureParentDir, writeBuffer } from '../../utils/fs.js';
import { downloadFile } from '../../utils/download.js';
import { getMimeType } from '../../utils/mime.js';
import { statSync } from 'node:fs';

export class OpenRouterProvider implements FullProvider {
  id = 'openrouter';
  name = 'OpenRouter';
  capabilities: ProviderCapability[] = [
    'image-generate',
    'video-generate',
  ];

  private getApiKey(): string {
    const config = getProviderConfig('openrouter');
    if (!config?.apiKey) {
      throw new MediaGenError(
        'PROVIDER_NOT_CONFIGURED',
        'Missing OPENROUTER_API_KEY',
        {
          provider: 'openrouter',
          suggestion:
            'Set OPENROUTER_API_KEY in your environment or run media-gen config init.',
        },
      );
    }
    return config.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.getApiKey()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/media-gen-cli',
      'X-Title': 'media-gen-cli',
    };
  }

  async validateConfig(): Promise<ValidationResult> {
    const config = getProviderConfig('openrouter');
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config?.apiKey) {
      errors.push('OPENROUTER_API_KEY is not set');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async generateImage(input: ImageGenerationInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();
    const model = input.model || 'openai/gpt-image-1';

    log.debug({ model, prompt: input.prompt }, 'OpenRouter image generation');

    const body: Record<string, unknown> = {
      model,
      prompt: input.prompt,
      n: input.n || 1,
    };

    if (input.size) body.size = input.size;
    if (input.quality) body.quality = input.quality;

    const response = await fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errObj = err as Record<string, unknown>;
      const message =
        (errObj?.error as Record<string, string>)?.message ||
        (errObj as Record<string, string>)?.message ||
        `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, {
        provider: 'openrouter',
      });
    }

    const data = (await response.json()) as {
      data?: Array<{
        b64_json?: string;
        url?: string;
        revised_prompt?: string;
      }>;
    };

    const imageData = data.data?.[0];
    if (!imageData) {
      throw new MediaGenError('API_ERROR', 'No image data in response', {
        provider: 'openrouter',
      });
    }

    ensureParentDir(input.outputFile);

    if (imageData.b64_json) {
      const buffer = Buffer.from(imageData.b64_json, 'base64');
      writeBuffer(input.outputFile, buffer);
    } else if (imageData.url) {
      await downloadFile(imageData.url, input.outputFile);
    } else {
      throw new MediaGenError('API_ERROR', 'Response has no image data or URL', {
        provider: 'openrouter',
      });
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

  async generateVideo(input: VideoGenerationInput): Promise<AsyncMediaResult> {
    const log = getLogger();
    const model = input.model || 'google/veo-3.1';

    log.debug({ model, prompt: input.prompt }, 'OpenRouter video generation');

    const body: Record<string, unknown> = {
      model,
      prompt: input.prompt,
    };

    if (input.duration) body.duration = input.duration;
    if (input.aspectRatio) body.aspect_ratio = input.aspectRatio;
    if (input.resolution) body.resolution = input.resolution;

    const response = await fetch('https://openrouter.ai/api/v1/videos', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const errObj = err as Record<string, unknown>;
      const message =
        (errObj?.error as Record<string, string>)?.message ||
        (errObj as Record<string, string>)?.message ||
        `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, {
        provider: 'openrouter',
      });
    }

    const data = (await response.json()) as {
      id?: string;
      generation_id?: string;
      status?: string;
      polling_url?: string;
    };

    return {
      jobId: data.id || data.generation_id || 'unknown',
      provider: 'openrouter',
      status: 'queued',
      statusUrl: data.polling_url
        ? (data.polling_url.startsWith('http') ? data.polling_url : `https://openrouter.ai${data.polling_url}`)
        : undefined,
    };
  }

  async getJobStatus(jobId: string): Promise<import('../../core/provider.js').JobStatusResult> {
    const url = `https://openrouter.ai/api/v1/videos/${jobId}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.getApiKey()}` },
    });

    if (!response.ok) {
      throw new MediaGenError('API_ERROR', `Status check failed: HTTP ${response.status}`, { provider: 'openrouter' });
    }

    const data = (await response.json()) as {
      id: string;
      status: string;
      unsigned_urls?: string[];
      error?: string;
    };

    const statusMap: Record<string, import('../../core/provider.js').JobStatusResult['status']> = {
      pending: 'queued',
      processing: 'processing',
      completed: 'completed',
      failed: 'failed',
    };

    return {
      jobId: data.id || jobId,
      provider: 'openrouter',
      status: statusMap[data.status] || 'processing',
      error: data.error,
    };
  }

  async downloadJob(jobId: string, outputFile: string): Promise<MediaResult> {
    const startTime = Date.now();
    const url = `https://openrouter.ai/api/v1/videos/${jobId}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.getApiKey()}` },
    });

    if (!response.ok) {
      throw new MediaGenError('API_ERROR', `Failed to get job: HTTP ${response.status}`, { provider: 'openrouter' });
    }

    const data = (await response.json()) as {
      status: string;
      unsigned_urls?: string[];
    };

    if (data.status !== 'completed' || !data.unsigned_urls?.[0]) {
      throw new MediaGenError('JOB_FAILED', 'Job not completed or no video URL', { provider: 'openrouter' });
    }

    // Download using the unsigned URL with auth header
    const videoUrl = data.unsigned_urls[0];
    const videoResp = await fetch(videoUrl, {
      headers: { Authorization: `Bearer ${this.getApiKey()}` },
      redirect: 'follow',
    });

    if (!videoResp.ok) {
      throw new MediaGenError('API_ERROR', `Video download failed: HTTP ${videoResp.status}`, { provider: 'openrouter' });
    }

    const buffer = Buffer.from(await videoResp.arrayBuffer());
    ensureParentDir(outputFile);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(outputFile, buffer);

    return {
      outputFile,
      mimeType: getMimeType(outputFile),
      sizeBytes: buffer.length,
      durationMs: Date.now() - startTime,
    };
  }
}
