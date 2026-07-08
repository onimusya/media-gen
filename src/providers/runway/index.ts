/**
 * Runway provider adapter for media-gen-cli.
 * Supports: video generation, image-to-video.
 */

import type {
  FullProvider,
  ProviderCapability,
  ValidationResult,
  ImageGenerationInput,
  VideoGenerationInput,
  ImageToVideoInput,
  AsyncMediaResult,
  MediaResult,
  JobStatusResult,
} from '../../core/provider.js';
import { MediaGenError } from '../../core/errors.js';
import { getProviderConfig } from '../../core/config.js';
import { getLogger } from '../../core/logger.js';
import { ensureParentDir } from '../../utils/fs.js';
import { downloadFile } from '../../utils/download.js';
import { getMimeType } from '../../utils/mime.js';
import { readFileSync, statSync } from 'node:fs';

export class RunwayProvider implements FullProvider {
  id = 'runway';
  name = 'Runway';
  capabilities: ProviderCapability[] = ['image-generate', 'video-generate', 'video-image-to-video'];

  private getApiKey(): string {
    const config = getProviderConfig('runway');
    if (!config?.apiKey) {
      throw new MediaGenError('PROVIDER_NOT_CONFIGURED', 'Missing RUNWAY_API_KEY', {
        provider: 'runway',
        suggestion: 'Set RUNWAY_API_KEY in your environment or run media-gen config init.',
      });
    }
    return config.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.getApiKey()}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06',
    };
  }

  async validateConfig(): Promise<ValidationResult> {
    const config = getProviderConfig('runway');
    const errors: string[] = [];
    if (!config?.apiKey) errors.push('RUNWAY_API_KEY is not set');
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  async generateImage(input: ImageGenerationInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();
    const model = input.model || 'gen4_image';
    log.debug({ model, prompt: input.prompt }, 'Runway image generation');

    const body: Record<string, unknown> = {
      model,
      promptText: input.prompt,
    };
    if (input.size) body.ratio = this.sizeToRatio(input.size);

    const response = await fetch('https://api.dev.runwayml.com/v1/text_to_image', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, string>)?.error || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'runway' });
    }

    const data = (await response.json()) as { id: string; output?: string[] };

    // If output is returned directly (sync)
    if (data.output?.[0]) {
      ensureParentDir(input.outputFile);
      await downloadFile(data.output[0], input.outputFile);
      return {
        outputFile: input.outputFile,
        mimeType: getMimeType(input.outputFile),
        sizeBytes: statSync(input.outputFile).size,
        durationMs: Date.now() - startTime,
      };
    }

    // Otherwise poll for result
    const jobId = data.id;
    let attempts = 0;
    while (attempts < 60) {
      await new Promise((r) => setTimeout(r, 3000));
      const status = await this.getJobStatus(jobId);
      if (status.status === 'completed') {
        const result = await this.downloadJob(jobId, input.outputFile);
        return result;
      }
      if (status.status === 'failed') {
        throw new MediaGenError('JOB_FAILED', status.error || 'Image generation failed', { provider: 'runway' });
      }
      attempts++;
    }
    throw new MediaGenError('JOB_TIMEOUT', 'Image generation timed out', { provider: 'runway' });
  }

  private sizeToRatio(size: string): string {
    const [w, h] = size.split('x').map(Number);
    if (w === h) return '1:1';
    if (w > h) return '16:9';
    return '9:16';
  }

  async generateVideo(input: VideoGenerationInput): Promise<AsyncMediaResult> {
    const log = getLogger();
    const model = input.model || 'gen4_turbo';
    log.debug({ model, prompt: input.prompt }, 'Runway video generation');

    const body: Record<string, unknown> = {
      model,
      promptText: input.prompt,
    };
    if (input.duration) body.duration = input.duration;
    if (input.aspectRatio) body.ratio = input.aspectRatio;

    const response = await fetch('https://api.dev.runwayml.com/v1/text_to_video', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, string>)?.error || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'runway' });
    }

    const data = (await response.json()) as { id: string };
    return { jobId: data.id, provider: 'runway', status: 'processing' };
  }

  async imageToVideo(input: ImageToVideoInput): Promise<AsyncMediaResult> {
    const log = getLogger();
    log.debug({ model: input.model, image: input.image }, 'Runway image-to-video');

    const imgBuffer = readFileSync(input.image);
    const mime = getMimeType(input.image);
    const dataUrl = `data:${mime};base64,${imgBuffer.toString('base64')}`;

    const body: Record<string, unknown> = {
      model: input.model || 'gen4_turbo',
      promptImage: dataUrl,
      promptText: input.prompt || '',
    };
    if (input.duration) body.duration = input.duration;

    const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, string>)?.error || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'runway' });
    }

    const data = (await response.json()) as { id: string };
    return { jobId: data.id, provider: 'runway', status: 'processing' };
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${jobId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new MediaGenError('API_ERROR', `Status check failed: HTTP ${response.status}`, { provider: 'runway' });
    }

    const data = (await response.json()) as {
      status: string;
      failure?: string;
      output?: string[];
    };

    const statusMap: Record<string, JobStatusResult['status']> = {
      PENDING: 'queued',
      THROTTLED: 'queued',
      RUNNING: 'processing',
      SUCCEEDED: 'completed',
      FAILED: 'failed',
    };

    return {
      jobId,
      provider: 'runway',
      status: statusMap[data.status] || 'processing',
      error: data.failure,
    };
  }

  async downloadJob(jobId: string, outputFile: string): Promise<MediaResult> {
    const startTime = Date.now();
    const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${jobId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new MediaGenError('API_ERROR', `Failed to get task: HTTP ${response.status}`, { provider: 'runway' });
    }

    const data = (await response.json()) as { status: string; output?: string[] };
    if (data.status !== 'SUCCEEDED' || !data.output?.[0]) {
      throw new MediaGenError('JOB_FAILED', 'Job not completed or no output', { provider: 'runway' });
    }

    ensureParentDir(outputFile);
    await downloadFile(data.output[0], outputFile);

    return {
      outputFile,
      mimeType: getMimeType(outputFile),
      sizeBytes: statSync(outputFile).size,
      durationMs: Date.now() - startTime,
    };
  }
}
