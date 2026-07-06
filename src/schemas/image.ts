/**
 * Zod schemas for image generation and editing inputs.
 */

import { z } from 'zod';
import { ProviderIdSchema, OutputOptionsSchema } from './common.js';

export const ImageSizeSchema = z.string().regex(/^\d+x\d+$/, {
  message: 'Size must be in WIDTHxHEIGHT format (e.g., 1024x1024)',
});

export const ImageQualitySchema = z.enum(['standard', 'hd', 'low', 'medium', 'high', 'auto']);

export const ImageStyleSchema = z.enum(['natural', 'vivid']);

export const ImageGenerateSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().default('gpt-image-1'),
  prompt: z.string().min(1, 'Prompt is required'),
  size: ImageSizeSchema.optional().default('1024x1024'),
  quality: ImageQualitySchema.optional(),
  style: ImageStyleSchema.optional(),
  n: z.number().int().min(1).max(10).optional().default(1),
  negativePrompt: z.string().optional(),
  ...OutputOptionsSchema.shape,
});

export type ImageGenerateInput = z.infer<typeof ImageGenerateSchema>;

export const ImageEditSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().default('gpt-image-1'),
  image: z.string().min(1, 'Image path is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  mask: z.string().optional(),
  size: ImageSizeSchema.optional(),
  ...OutputOptionsSchema.shape,
});

export type ImageEditInput = z.infer<typeof ImageEditSchema>;
