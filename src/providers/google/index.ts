/**
 * Google provider adapter for media-gen-cli.
 * Supports: Nano Banana images/editing, Omni video, Gemini speech.
 * Uses the Gemini API (generativelanguage.googleapis.com/v1beta).
 */

import type {
  FullProvider,
  ProviderCapability,
  ValidationResult,
  ImageGenerationInput,
  ImageEditInput,
  ImageToVideoInput,
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
import { readFileSync, writeFileSync } from 'node:fs';

interface InteractionResponse {
  steps?: Array<{ type: string; content?: Array<{ type: string; data?: string; mime_type?: string }> }>;
}

export class GoogleProvider implements FullProvider {
  id = 'google';
  name = 'Google (Gemini / Nano Banana / Omni)';
  capabilities: ProviderCapability[] = [
    'image-generate',
    'image-edit',
    'video-generate',
    'video-image-to-video',
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
    const model = input.model || 'gemini-nano-banana-2.1';
    if (!model.startsWith('gemini-')) {
      throw new MediaGenError('INVALID_INPUT', 'Imagen is shut down in the Gemini API. Use gemini-nano-banana-2.1.', { provider: 'google' });
    }
    return this.generateInteractionImage(input, model);
  }

  private async interaction(body: Record<string, unknown>): Promise<InteractionResponse> {
    const response = await fetch(`${this.getBaseUrl()}/interactions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ...body, store: false }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new MediaGenError('API_ERROR', err.error?.message || `HTTP ${response.status}`, { provider: 'google' });
    }
    return await response.json() as InteractionResponse;
  }

  private saveInteraction(data: InteractionResponse, type: string, outputFile: string, startTime: number): MediaResult {
    // output_image/audio/video are SDK helpers; REST returns model_output steps.
    const parts = data.steps?.filter(step => step.type === 'model_output')
      .flatMap(step => step.content || []).filter(part => part.type === type && part.data);
    const part = parts?.[parts.length - 1];
    if (!part?.data) {
      throw new MediaGenError('API_ERROR', `No ${type} data in interaction response`, { provider: 'google' });
    }
    let buffer: Buffer = Buffer.from(part.data, 'base64');
    let mimeType = part.mime_type || getMimeType(outputFile);
    if (type === 'audio' && /audio\/(L16|pcm)/i.test(mimeType)) {
      const rate = Number(/rate=(\d+)/i.exec(mimeType)?.[1] || 24000);
      buffer = this.pcmToWav(buffer, rate, 1, 16);
      mimeType = 'audio/wav';
    }
    ensureParentDir(outputFile);
    writeBuffer(outputFile, buffer);
    return { outputFile, mimeType, sizeBytes: buffer.length, durationMs: Date.now() - startTime };
  }

  private async generateInteractionImage(input: ImageGenerationInput | ImageEditInput, model: string): Promise<MediaResult> {
    const startTime = Date.now();
    const maxSide = input.size ? Math.max(...input.size.split('x').map(Number)) : 1024;
    const content: Record<string, unknown>[] = [{ type: 'text', text: input.prompt }];
    if ('image' in input) {
      if (input.mask) throw new MediaGenError('INVALID_INPUT', 'Google image editing does not support masks', { provider: 'google' });
      content.push({ type: 'image', data: readFileSync(input.image).toString('base64'), mime_type: getMimeType(input.image) });
    }
    const data = await this.interaction({
      model,
      input: [{ type: 'user_input', content }],
      response_format: {
        type: 'image',
        ...(input.size && { aspect_ratio: this.sizeToAspectRatio(input.size), image_size: maxSide > 2048 ? '4K' : maxSide > 1024 ? '2K' : '1K' }),
      },
    });
    return this.saveInteraction(data, 'image', input.outputFile, startTime);
  }

  async editImage(input: ImageEditInput): Promise<MediaResult> {
    const model = input.model || 'gemini-nano-banana-2.1';
    if (!model.startsWith('gemini-')) throw new MediaGenError('INVALID_INPUT', 'Use a Gemini image model for editing', { provider: 'google' });
    return this.generateInteractionImage(input, model);
  }

  async generateVideo(input: VideoGenerationInput): Promise<AsyncMediaResult | MediaResult> {
    const model = input.model || 'gemini-omni-1.1-flash';
    if (model.startsWith('gemini-omni-')) return this.generateOmniVideo(input);
    if (model.startsWith('veo-3.1-') && model.endsWith('-preview')) {
      throw new MediaGenError('INVALID_INPUT', 'Veo 3.1 Preview shut down on 2026-10-22. Use gemini-omni-1.1-flash.', { provider: 'google' });
    }
    const log = getLogger();

    log.debug({ model, prompt: input.prompt }, 'Google video generation');

    const url = `${this.getBaseUrl()}/models/${model}:predictLongRunning`;

    const body: Record<string, unknown> = {
      instances: [{ prompt: input.prompt }],
      parameters: {
        ...(input.duration && { durationSeconds: input.duration }),
        ...(input.aspectRatio && { aspectRatio: input.aspectRatio }),
        ...(input.resolution && { resolution: input.resolution }),
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

  private async generateOmniVideo(input: VideoGenerationInput | ImageToVideoInput): Promise<MediaResult> {
    const startTime = Date.now();
    const content: Record<string, unknown>[] = [{ type: 'text', text: input.prompt || 'Animate this image.' }];
    if ('image' in input) content.push({ type: 'image', data: readFileSync(input.image).toString('base64'), mime_type: getMimeType(input.image) });
    // Omni timing is prompt-controlled; there is no durationSeconds request field.
    if (input.duration) content.push({ type: 'text', text: `Generate a video lasting ${input.duration} seconds.` });
    const data = await this.interaction({
      model: input.model || 'gemini-omni-1.1-flash',
      input: [{ type: 'user_input', content }],
      response_format: {
        type: 'video',
        ...(input.aspectRatio && { aspect_ratio: input.aspectRatio }),
        ...('resolution' in input && input.resolution && { resolution: input.resolution }),
      },
    });
    return this.saveInteraction(data, 'video', input.outputFile, startTime);
  }

  async imageToVideo(input: ImageToVideoInput): Promise<MediaResult> {
    if (input.model && !input.model.startsWith('gemini-omni-')) {
      throw new MediaGenError('INVALID_INPUT', 'Use gemini-omni-1.1-flash for Google image-to-video', { provider: 'google' });
    }
    return this.generateOmniVideo(input);
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
    const model = input.model || 'gemini-3.8-flash-tts';
    const voice = input.voiceId || 'Kore';

    log.debug({ model, voice }, 'Google Gemini TTS');

    const url = `${this.getBaseUrl()}/interactions`;
    const body = {
      model,
      input: [{ type: 'user_input', content: [{ type: 'text', text: input.text,
        ...(input.instructions && { annotations: [{ type: 'speech_metadata', style: input.instructions }] }),
      }] }],
      store: false,
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

    const data = await response.json() as InteractionResponse;
    return { ...this.saveInteraction(data, 'audio', input.outputFile, startTime), metadata: { voice, model } };
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
    const ratios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
    const distance = (ratio: string) => { const [a, b] = ratio.split(':').map(Number); return Math.abs(a / b - w / h); };
    return ratios.reduce((best, ratio) => distance(ratio) < distance(best) ? ratio : best);
  }
}
