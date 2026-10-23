/**
 * Luma AI provider adapter for media-gen-cli.
 * Supports: video generation, image-to-video.
 */

import type {
  FullProvider,
  ProviderCapability,
  ValidationResult,
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

export class LumaProvider implements FullProvider {
  id = 'luma';
  name = 'Luma AI';
  capabilities: ProviderCapability[] = ['video-generate', 'video-image-to-video'];

  private getApiKey(): string {
    const config = getProviderConfig('luma');
    if (!config?.apiKey) {
      throw new MediaGenError('PROVIDER_NOT_CONFIGURED', 'Missing LUMA_API_KEY', {
        provider: 'luma',
        suggestion: 'Set LUMA_API_KEY in your environment or run media-gen config init.',
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
    const config = getProviderConfig('luma');
    const errors: string[] = [];
    if (!config?.apiKey) errors.push('LUMA_API_KEY is not set');
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  async generateVideo(input: VideoGenerationInput): Promise<AsyncMediaResult> {
    if (!input.model || input.model === 'ray-3.2') {
      return this.submitAgentsVideo(input);
    }
    const log = getLogger();
    const model = input.model || 'ray-2';
    log.debug({ model, prompt: input.prompt }, 'Luma video generation');

    const body: Record<string, unknown> = {
      prompt: input.prompt,
      model,
    };
    if (input.aspectRatio) body.aspect_ratio = input.aspectRatio;
    if (input.duration) body.duration = `${input.duration}s`;
    if (input.resolution) body.resolution = input.resolution;

    const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, string>)?.detail || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'luma' });
    }

    const data = (await response.json()) as { id: string; state: string };
    return { jobId: data.id, provider: 'luma', status: 'processing' };
  }

  async imageToVideo(input: ImageToVideoInput): Promise<AsyncMediaResult> {
    if (!input.model || input.model === 'ray-3.2') {
      return this.submitAgentsVideo(input);
    }
    const log = getLogger();
    log.debug({ model: input.model, image: input.image }, 'Luma image-to-video');

    // Convert image to base64 data URL
    const imgBuffer = readFileSync(input.image);
    const mime = getMimeType(input.image);
    const dataUrl = `data:${mime};base64,${imgBuffer.toString('base64')}`;

    const body: Record<string, unknown> = {
      prompt: input.prompt || '',
      model: input.model || 'ray-2',
      keyframes: { frame0: { type: 'image', url: dataUrl } },
    };
    if (input.aspectRatio) body.aspect_ratio = input.aspectRatio;

    const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, string>)?.detail || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'luma' });
    }

    const data = (await response.json()) as { id: string };
    return { jobId: data.id, provider: 'luma', status: 'processing' };
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    const response = await fetch(
      this.jobUrl(jobId),
      { headers: this.getHeaders() },
    );

    if (!response.ok) {
      throw new MediaGenError('API_ERROR', `Status check failed: HTTP ${response.status}`, { provider: 'luma' });
    }

    const data = (await response.json()) as {
      state: string;
      failure_reason?: string;
      assets?: { video?: string };
    };

    const stateMap: Record<string, JobStatusResult['status']> = {
      queued: 'queued',
      dreaming: 'processing',
      processing: 'processing',
      running: 'processing',
      pending: 'queued',
      completed: 'completed',
      failed: 'failed',
    };

    return {
      jobId,
      provider: 'luma',
      status: stateMap[data.state] || 'processing',
      error: data.failure_reason,
    };
  }

  async downloadJob(jobId: string, outputFile: string): Promise<MediaResult> {
    const startTime = Date.now();
    const response = await fetch(
      this.jobUrl(jobId),
      { headers: this.getHeaders() },
    );

    if (!response.ok) {
      throw new MediaGenError('API_ERROR', `Failed to get job: HTTP ${response.status}`, { provider: 'luma' });
    }

    const data = (await response.json()) as { state: string; assets?: { video?: string }; output?: Array<{ url?: string }> };
    const videoUrl = data.output?.[0]?.url || data.assets?.video;
    if (data.state !== 'completed' || !videoUrl) {
      throw new MediaGenError('JOB_FAILED', 'Job not completed or no video available', { provider: 'luma' });
    }

    ensureParentDir(outputFile);
    await downloadFile(videoUrl, outputFile);

    return {
      outputFile,
      mimeType: getMimeType(outputFile),
      sizeBytes: statSync(outputFile).size,
      durationMs: Date.now() - startTime,
    };
  }

  private jobUrl(jobId: string): string {
    return jobId.startsWith('agents::')
      ? `https://agents.lumalabs.ai/v1/generations/${encodeURIComponent(jobId.slice(8))}`
      : `https://api.lumalabs.ai/dream-machine/v1/generations/${encodeURIComponent(jobId)}`;
  }

  private async submitAgentsVideo(input: VideoGenerationInput | ImageToVideoInput): Promise<AsyncMediaResult> {
    const video: Record<string, unknown> = {
      duration: `${input.duration || 5}s`,
      resolution: 'resolution' in input && input.resolution || '720p',
    };
    if ('image' in input) video.start_frame = { data: readFileSync(input.image).toString('base64'), media_type: getMimeType(input.image) };
    const response = await fetch('https://agents.lumalabs.ai/v1/generations', {
      method: 'POST', headers: this.getHeaders(),
      body: JSON.stringify({ model: 'ray-3.2', type: 'video', prompt: input.prompt || 'Animate this image.', aspect_ratio: input.aspectRatio || '16:9', video }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { detail?: string; message?: string };
      throw new MediaGenError('API_ERROR', err.message || err.detail || `HTTP ${response.status}`, { provider: 'luma' });
    }
    const data = await response.json() as { id?: string };
    if (!data.id) throw new MediaGenError('API_ERROR', 'No generation ID returned', { provider: 'luma' });
    return { jobId: `agents::${data.id}`, provider: 'luma', status: 'processing' };
  }
}
