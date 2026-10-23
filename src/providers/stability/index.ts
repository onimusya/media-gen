/**
 * Stability AI provider adapter for media-gen-cli.
 * Supports: image generation.
 */

import type {
  FullProvider,
  ProviderCapability,
  ValidationResult,
  ImageGenerationInput,
  MediaResult,
} from '../../core/provider.js';
import { MediaGenError } from '../../core/errors.js';
import { getProviderConfig } from '../../core/config.js';
import { getLogger } from '../../core/logger.js';
import { ensureParentDir, writeBuffer } from '../../utils/fs.js';
import { getMimeType } from '../../utils/mime.js';
import { statSync } from 'node:fs';

export class StabilityProvider implements FullProvider {
  id = 'stability';
  name = 'Stability AI';
  capabilities: ProviderCapability[] = ['image-generate'];

  private getApiKey(): string {
    const config = getProviderConfig('stability');
    if (!config?.apiKey) {
      throw new MediaGenError('PROVIDER_NOT_CONFIGURED', 'Missing STABILITY_API_KEY', {
        provider: 'stability',
        suggestion: 'Set STABILITY_API_KEY in your environment or run media-gen config init.',
      });
    }
    return config.apiKey;
  }

  async validateConfig(): Promise<ValidationResult> {
    const config = getProviderConfig('stability');
    const errors: string[] = [];
    if (!config?.apiKey) errors.push('STABILITY_API_KEY is not set');
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  async generateImage(input: ImageGenerationInput): Promise<MediaResult> {
    const log = getLogger();
    const startTime = Date.now();
    const model = input.model || 'stable-image-core';
    log.debug({ model, prompt: input.prompt }, 'Stability image generation');

    if (model.startsWith('sd3') || model.startsWith('stable-image-')) {
      return this.generateStableImage(input, model, startTime);
    }

    const body: Record<string, unknown> = {
      text_prompts: [{ text: input.prompt, weight: 1 }],
      samples: input.n || 1,
    };

    if (input.negativePrompt) {
      (body.text_prompts as Array<{ text: string; weight: number }>).push({ text: input.negativePrompt, weight: -1 });
    }

    if (input.size) {
      const [w, h] = input.size.split('x').map(Number);
      body.width = w;
      body.height = h;
    }

    const response = await fetch(
      `https://api.stability.ai/v1/generation/${model}/text-to-image`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.getApiKey()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = (err as Record<string, string>)?.message || `HTTP ${response.status}`;
      throw new MediaGenError('API_ERROR', message, { provider: 'stability' });
    }

    const data = (await response.json()) as { artifacts: Array<{ base64: string; finishReason: string }> };
    const artifact = data.artifacts[0];

    if (artifact.finishReason === 'CONTENT_FILTERED') {
      throw new MediaGenError('CONTENT_POLICY_VIOLATION', 'Content filtered by Stability AI safety system', {
        provider: 'stability',
      });
    }

    const buffer = Buffer.from(artifact.base64, 'base64');
    ensureParentDir(input.outputFile);
    writeBuffer(input.outputFile, buffer);

    return {
      outputFile: input.outputFile,
      mimeType: getMimeType(input.outputFile),
      sizeBytes: statSync(input.outputFile).size,
      durationMs: Date.now() - startTime,
    };
  }

  private async generateStableImage(input: ImageGenerationInput, model: string, startTime: number): Promise<MediaResult> {
    const endpoint = model === 'stable-image-ultra' ? 'ultra' : model === 'stable-image-core' ? 'core' : 'sd3';
    const form = new FormData();
    form.append('prompt', input.prompt);
    form.append('output_format', 'png');
    if (endpoint === 'sd3') form.append('model', model);
    if (input.negativePrompt) form.append('negative_prompt', input.negativePrompt);
    if (input.size) {
      const [w, h] = input.size.split('x').map(Number);
      const ratios = ['1:1', '16:9', '21:9', '2:3', '3:2', '4:5', '5:4', '9:16', '9:21'];
      const ratio = ratios.reduce((best, value) => {
        const distance = (r: string) => { const [a, b] = r.split(':').map(Number); return Math.abs(a / b - w / h); };
        return distance(value) < distance(best) ? value : best;
      });
      form.append('aspect_ratio', ratio);
    }
    const response = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/${endpoint}`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.getApiKey()}`, Accept: 'application/json' }, body: form,
    });
    if (response.status === 403) throw new MediaGenError('CONTENT_POLICY_VIOLATION', 'Content filtered by Stability AI', { provider: 'stability' });
    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { errors?: string[]; message?: string };
      throw new MediaGenError('API_ERROR', err.errors?.join('; ') || err.message || `HTTP ${response.status}`, { provider: 'stability' });
    }
    const data = await response.json() as { image?: string; finish_reason?: string };
    if (data.finish_reason === 'CONTENT_FILTERED') throw new MediaGenError('CONTENT_POLICY_VIOLATION', 'Content filtered by Stability AI', { provider: 'stability' });
    if (!data.image) throw new MediaGenError('API_ERROR', 'No image returned', { provider: 'stability' });
    const buffer = Buffer.from(data.image, 'base64');
    ensureParentDir(input.outputFile);
    writeBuffer(input.outputFile, buffer);
    return { outputFile: input.outputFile, mimeType: 'image/png', sizeBytes: buffer.length, durationMs: Date.now() - startTime };
  }
}
