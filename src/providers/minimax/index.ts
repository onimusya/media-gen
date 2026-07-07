/**
 * MiniMax provider adapter for media-gen-cli.
 * Supports: video generation (Hailuo), text-to-speech.
 * API docs: https://platform.minimax.io/docs
 */

import type {
  FullProvider,
  ProviderCapability,
  ValidationResult,
  VideoGenerationInput,
  ImageToVideoInput,
  TextToSpeechInput,
  AsyncMediaResult,
  MediaResult,
  JobStatusResult,
} from '../../core/provider.js';
import { MediaGenError } from '../../core/errors.js';
import { getProviderConfig } from '../../core/config.js';
import { getLogger } from '../../core/logger.js';
import { ensureParentDir } from '../../utils/fs.js';
import { getMimeType } from '../../utils/mime.js';
import { writeFileSync, statSync } from 'node:fs';

export class MinimaxProvider implements FullProvider {
  id = 'minimax';
  name = 'MiniMax (Hailuo)';
  capabilities: ProviderCapability[] = [
    'video-generate',
    'video-image-to-video',
    'voice-tts',
  ];

  private getApiKey(): string {
    const config = getProviderConfig('minimax');
    if (!config?.apiKey) {
      throw new MediaGenError('PROVIDER_NOT_CONFIGURED', 'Missing MINIMAX_API_KEY', {
        provider: 'minimax',
        suggestion: 'Set MINIMAX_API_KEY in your environment or run media-gen config init.',
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
    const config = getProviderConfig('minimax');
    const errors: string[] = [];
    if (!config?.apiKey) errors.push('MINIMAX_API_KEY is not set');
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  async generateVideo(input: VideoGenerationInput): Promise<AsyncMediaResult> {
    const log = getLogger();
    const model = input.model || 'MiniMax-Hailuo-2.3';
    log.debug({ model, prompt: input.prompt }, 'MiniMax video generation');

    const body: Record<string, unknown> = {
      model,
      prompt: input.prompt,
    };

    if (input.duration) body.duration = input.duration;
    if (input.resolution) body.resolution = input.resolution;

    const response = await fetch('https://api.minimax.io/v1/video_generation', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.base_resp?.status_msg || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'minimax' });
    }

    const data = (await response.json()) as { task_id: string; base_resp: { status_code: number } };
    if (data.base_resp.status_code !== 0) {
      throw new MediaGenError('API_ERROR', 'Video generation request failed', { provider: 'minimax' });
    }

    return {
      jobId: data.task_id,
      provider: 'minimax',
      status: 'processing',
    };
  }

  async imageToVideo(input: ImageToVideoInput): Promise<AsyncMediaResult> {
    const log = getLogger();
    const model = input.model || 'MiniMax-Hailuo-2.3';
    log.debug({ model, image: input.image }, 'MiniMax image-to-video');

    // Read image and convert to base64 data URL
    const { readFileSync } = await import('node:fs');
    const imgBuffer = readFileSync(input.image);
    const mime = getMimeType(input.image);
    const dataUrl = `data:${mime};base64,${imgBuffer.toString('base64')}`;

    const body: Record<string, unknown> = {
      model,
      first_frame_image: dataUrl,
    };

    if (input.prompt) body.prompt = input.prompt;
    if (input.duration) body.duration = input.duration;

    const response = await fetch('https://api.minimax.io/v1/video_generation', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.base_resp?.status_msg || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'minimax' });
    }

    const data = (await response.json()) as { task_id: string; base_resp: { status_code: number } };
    return { jobId: data.task_id, provider: 'minimax', status: 'processing' };
  }

  async getJobStatus(jobId: string): Promise<JobStatusResult> {
    const response = await fetch(
      `https://api.minimax.io/v1/query/video_generation?task_id=${jobId}`,
      { headers: { Authorization: `Bearer ${this.getApiKey()}` } },
    );

    if (!response.ok) {
      throw new MediaGenError('API_ERROR', `Status check failed: HTTP ${response.status}`, { provider: 'minimax' });
    }

    const data = (await response.json()) as {
      task_id: string;
      status: string;
      file_id?: string;
      base_resp: { status_code: number; status_msg: string };
    };

    const statusMap: Record<string, JobStatusResult['status']> = {
      Queueing: 'queued',
      Processing: 'processing',
      Success: 'completed',
      Failed: 'failed',
    };

    return {
      jobId: data.task_id,
      provider: 'minimax',
      status: statusMap[data.status] || 'processing',
      error: data.status === 'Failed' ? data.base_resp.status_msg : undefined,
    };
  }

  async downloadJob(jobId: string, outputFile: string): Promise<MediaResult> {
    const startTime = Date.now();

    // First get the file_id from job status
    const statusResp = await fetch(
      `https://api.minimax.io/v1/query/video_generation?task_id=${jobId}`,
      { headers: { Authorization: `Bearer ${this.getApiKey()}` } },
    );

    if (!statusResp.ok) {
      throw new MediaGenError('API_ERROR', `Failed to query job: HTTP ${statusResp.status}`, { provider: 'minimax' });
    }

    const statusData = (await statusResp.json()) as { status: string; file_id?: string };
    if (statusData.status !== 'Success' || !statusData.file_id) {
      throw new MediaGenError('JOB_FAILED', 'Job not completed or no file_id', { provider: 'minimax' });
    }

    // Download using file_id
    const downloadResp = await fetch(
      `https://api.minimax.io/v1/files/retrieve?file_id=${statusData.file_id}`,
      { headers: { Authorization: `Bearer ${this.getApiKey()}` } },
    );

    if (!downloadResp.ok) {
      throw new MediaGenError('API_ERROR', `Download failed: HTTP ${downloadResp.status}`, { provider: 'minimax' });
    }

    const downloadData = (await downloadResp.json()) as { file?: { download_url?: string } };
    const downloadUrl = downloadData.file?.download_url;

    if (!downloadUrl) {
      throw new MediaGenError('JOB_FAILED', 'No download URL in response', { provider: 'minimax' });
    }

    const videoResp = await fetch(downloadUrl);
    if (!videoResp.ok) {
      throw new MediaGenError('API_ERROR', `Video download failed: HTTP ${videoResp.status}`, { provider: 'minimax' });
    }

    const buffer = Buffer.from(await videoResp.arrayBuffer());
    ensureParentDir(outputFile);
    writeFileSync(outputFile, buffer);

    return {
      outputFile,
      mimeType: getMimeType(outputFile),
      sizeBytes: statSync(outputFile).size,
      durationMs: Date.now() - startTime,
    };
  }

  async textToSpeech(input: TextToSpeechInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();
    const model = input.model || 'speech-2.8-hd';
    const voiceId = input.voiceId || 'English_expressive_narrator';

    log.debug({ model, voiceId }, 'MiniMax TTS');

    const body: Record<string, unknown> = {
      model,
      text: input.text,
      voice_setting: {
        voice_id: voiceId,
        speed: input.speed || 1.0,
      },
      audio_setting: {
        format: input.format === 'wav' ? 'wav' : 'mp3',
        sample_rate: 32000,
      },
    };

    const response = await fetch('https://api.minimax.io/v1/t2a_v2', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, Record<string, string>>)?.base_resp?.status_msg || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'minimax' });
    }

    const data = (await response.json()) as {
      audio_file?: string;
      base_resp: { status_code: number; status_msg: string };
    };

    if (data.base_resp.status_code !== 0 || !data.audio_file) {
      throw new MediaGenError('API_ERROR', data.base_resp.status_msg || 'TTS failed', { provider: 'minimax' });
    }

    // audio_file is hex-encoded audio data
    const buffer = Buffer.from(data.audio_file, 'hex');
    ensureParentDir(input.outputFile);
    writeFileSync(input.outputFile, buffer);

    return {
      outputFile: input.outputFile,
      mimeType: getMimeType(input.outputFile),
      sizeBytes: buffer.length,
      durationMs: Date.now() - startTime,
      metadata: { model, voiceId },
    };
  }
}
