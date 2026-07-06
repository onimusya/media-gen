/**
 * Fal.ai provider adapter for media-gen-cli.
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

export class FalProvider implements FullProvider {
  id = 'fal';
  name = 'Fal.ai';
  capabilities: ProviderCapability[] = ['image-generate', 'video-generate'];

  private getApiKey(): string {
    const config = getProviderConfig('fal');
    if (!config?.apiKey) {
      throw new MediaGenError('PROVIDER_NOT_CONFIGURED', 'Missing FAL_KEY', {
        provider: 'fal',
        suggestion: 'Set FAL_KEY in your environment or run media-gen config init.',
      });
    }
    return config.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Key ${this.getApiKey()}`,
      'Content-Type': 'application/json',
    };
  }

  async validateConfig(): Promise<ValidationResult> {
    const config = getProviderConfig('fal');
    const errors: string[] = [];
    if (!config?.apiKey) errors.push('FAL_KEY is not set');
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  async generateImage(input: ImageGenerationInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();
    const model = input.model || 'fal-ai/flux/dev';

    log.debug({ model, prompt: input.prompt }, 'Fal image generation');

    const body: Record<string, unknown> = {
      prompt: input.prompt,
      num_images: input.n || 1,
    };
    if (input.size) {
      const [w, h] = input.size.split('x').map(Number);
      body.image_size = { width: w, height: h };
    }
    if (input.negativePrompt) body.negative_prompt = input.negativePrompt;

    const response = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, string>)?.detail || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'fal' });
    }

    const data = (await response.json()) as { images: Array<{ url: string }> };
    const imageUrl = data.images[0]?.url;
    if (!imageUrl) throw new MediaGenError('API_ERROR', 'No image returned', { provider: 'fal' });

    ensureParentDir(input.outputFile);
    await downloadFile(imageUrl, input.outputFile);

    return {
      outputFile: input.outputFile,
      mimeType: getMimeType(input.outputFile),
      sizeBytes: statSync(input.outputFile).size,
      durationMs: Date.now() - startTime,
    };
  }

  async generateVideo(input: VideoGenerationInput): Promise<AsyncMediaResult> {
    const log = getLogger();
    const model = input.model || 'fal-ai/minimax-video-01';
    log.debug({ model, prompt: input.prompt }, 'Fal video generation');

    const body: Record<string, unknown> = { prompt: input.prompt };
    if (input.duration) body.duration = input.duration;

    const response = await fetch(`https://queue.fal.run/${model}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, string>)?.detail || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'fal' });
    }

    const data = (await response.json()) as { request_id: string; status_url: string };
    return {
      jobId: data.request_id,
      provider: 'fal',
      status: 'processing',
      statusUrl: data.status_url,
    };
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    const response = await fetch(`https://queue.fal.run/requests/${jobId}/status`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new MediaGenError('API_ERROR', `Status check failed: HTTP ${response.status}`, { provider: 'fal' });
    }

    const data = (await response.json()) as { status: string };
    const statusMap: Record<string, JobStatusResult['status']> = {
      IN_QUEUE: 'queued',
      IN_PROGRESS: 'processing',
      COMPLETED: 'completed',
      FAILED: 'failed',
    };

    return {
      jobId,
      provider: 'fal',
      status: statusMap[data.status] || 'processing',
    };
  }

  async downloadJob(jobId: string, outputFile: string): Promise<MediaResult> {
    const startTime = Date.now();
    const response = await fetch(`https://queue.fal.run/requests/${jobId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new MediaGenError('API_ERROR', `Download failed: HTTP ${response.status}`, { provider: 'fal' });
    }

    const data = (await response.json()) as { video?: { url: string } };
    if (!data.video?.url) {
      throw new MediaGenError('JOB_FAILED', 'No video URL in result', { provider: 'fal' });
    }

    ensureParentDir(outputFile);
    await downloadFile(data.video.url, outputFile);

    return {
      outputFile,
      mimeType: getMimeType(outputFile),
      sizeBytes: statSync(outputFile).size,
      durationMs: Date.now() - startTime,
    };
  }
}
