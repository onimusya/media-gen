/**
 * Zod schemas for video generation inputs.
 */

import { z } from 'zod';
import { ProviderIdSchema, OutputOptionsSchema, AsyncOptionsSchema } from './common.js';

export const AspectRatioSchema = z.string().regex(/^\d+:\d+$/, {
  message: 'Aspect ratio must be in W:H format (e.g., 16:9)',
});

export const VideoGenerateSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string(),
  prompt: z.string().min(1, 'Prompt is required'),
  duration: z.number().positive().optional(),
  aspectRatio: AspectRatioSchema.optional(),
  resolution: z.string().optional(),
  fps: z.number().int().positive().optional(),
  ...OutputOptionsSchema.shape,
  ...AsyncOptionsSchema.shape,
});

export type VideoGenerateInput = z.infer<typeof VideoGenerateSchema>;

export const ImageToVideoSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string(),
  image: z.string().min(1, 'Image path is required'),
  prompt: z.string().optional(),
  duration: z.number().positive().optional(),
  aspectRatio: AspectRatioSchema.optional(),
  ...OutputOptionsSchema.shape,
  ...AsyncOptionsSchema.shape,
});

export type ImageToVideoInput = z.infer<typeof ImageToVideoSchema>;

export const VideoExtendSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string(),
  video: z.string().min(1, 'Video path is required'),
  prompt: z.string().optional(),
  duration: z.number().positive().optional(),
  ...OutputOptionsSchema.shape,
  ...AsyncOptionsSchema.shape,
});

export type VideoExtendInput = z.infer<typeof VideoExtendSchema>;
