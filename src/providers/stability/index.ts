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
    const model = input.model || 'stable-diffusion-xl-1024-v1-0';
    log.debug({ model, prompt: input.prompt }, 'Stability image generation');

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
}
