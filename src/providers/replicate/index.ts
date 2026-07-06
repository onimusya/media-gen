/**
 * Replicate provider adapter for media-gen-cli.
 * Supports: image generation, video generation.
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
import { ensureParentDir } from '../../utils/fs.js';
import { downloadFile } from '../../utils/download.js';
import { getMimeType } from '../../utils/mime.js';
import { statSync } from 'node:fs';

export class ReplicateProvider implements FullProvider {
  id = 'replicate';
  name = 'Replicate';
  capabilities: ProviderCapability[] = ['image-generate', 'video-generate'];

  private getApiKey(): string {
    const config = getProviderConfig('replicate');
    if (!config?.apiKey) {
      throw new MediaGenError('PROVIDER_NOT_CONFIGURED', 'Missing REPLICATE_API_TOKEN', {
        provider: 'replicate',
        suggestion: 'Set REPLICATE_API_TOKEN in your environment or run media-gen config init.',
      });
    }
    return config.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.getApiKey()}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    };
  }

  async validateConfig(): Promise<ValidationResult> {
    const config = getProviderConfig('replicate');
    const errors: string[] = [];
    if (!config?.apiKey) errors.push('REPLICATE_API_TOKEN is not set');
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  async generateImage(input: ImageGenerationInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();
    const model = input.model || 'black-forest-labs/flux-schnell';
    log.debug({ model, prompt: input.prompt }, 'Replicate image generation');

    const body: Record<string, unknown> = {
      input: {
        prompt: input.prompt,
        ...(input.size && {
          width: parseInt(input.size.split('x')[0]),
          height: parseInt(input.size.split('x')[1]),
        }),
        ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
      },
    };

    const response = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, string>)?.detail || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'replicate' });
    }

    const data = (await response.json()) as { output: string | string[]; status: string };
    const outputUrl = Array.isArray(data.output) ? data.output[0] : data.output;
    if (!outputUrl) throw new MediaGenError('API_ERROR', 'No output URL', { provider: 'replicate' });

    ensureParentDir(input.outputFile);
    await downloadFile(outputUrl, input.outputFile);

    return {
      outputFile: input.outputFile,
      mimeType: getMimeType(input.outputFile),
      sizeBytes: statSync(input.outputFile).size,
      durationMs: Date.now() - startTime,
    };
  }

  async generateVideo(input: VideoGenerationInput): Promise<AsyncMediaResult> {
    const log = getLogger();
    const model = input.model || 'minimax/video-01';
    log.debug({ model, prompt: input.prompt }, 'Replicate video generation');

    const body: Record<string, unknown> = {
      input: {
        prompt: input.prompt,
        ...(input.duration && { duration: input.duration }),
      },
    };

    const response = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: 'POST',
      headers: { ...this.getHeaders(), Prefer: '' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, string>)?.detail || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'replicate' });
    }

    const data = (await response.json()) as { id: string; urls: { get: string } };
    return { jobId: data.id, provider: 'replicate', status: 'processing', statusUrl: data.urls.get };
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${jobId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new MediaGenError('API_ERROR', `Status check failed: HTTP ${response.status}`, { provider: 'replicate' });
    }

    const data = (await response.json()) as { status: string; output?: string | string[]; error?: string };
    const statusMap: Record<string, JobStatusResult['status']> = {
      starting: 'queued',
      processing: 'processing',
      succeeded: 'completed',
      failed: 'failed',
      canceled: 'failed',
    };

    return {
      jobId,
      provider: 'replicate',
      status: statusMap[data.status] || 'processing',
      error: data.error,
    };
  }

  async downloadJob(jobId: string, outputFile: string): Promise<MediaResult> {
    const startTime = Date.now();
    const response = await fetch(`https://api.replicate.com/v1/predictions/${jobId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new MediaGenError('API_ERROR', `Failed to get prediction: HTTP ${response.status}`, { provider: 'replicate' });
    }

    const data = (await response.json()) as { status: string; output?: string | string[] };
    if (data.status !== 'succeeded' || !data.output) {
      throw new MediaGenError('JOB_FAILED', 'Job not completed', { provider: 'replicate' });
    }

    const url = Array.isArray(data.output) ? data.output[0] : data.output;
    ensureParentDir(outputFile);
    await downloadFile(url, outputFile);

    return {
      outputFile,
      mimeType: getMimeType(outputFile),
      sizeBytes: statSync(outputFile).size,
      durationMs: Date.now() - startTime,
    };
  }
}
