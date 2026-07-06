/**
 * Zod schemas for audio transcription and translation inputs.
 */

import { z } from 'zod';
import { ProviderIdSchema, OutputOptionsSchema } from './common.js';

export const TranscribeSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().optional(),
  input: z.string().min(1, 'Input file path is required'),
  language: z.string().optional(),
  ...OutputOptionsSchema.shape,
});

export type TranscribeInput = z.infer<typeof TranscribeSchema>;

export const TranslateSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().optional(),
  input: z.string().min(1, 'Input file path is required'),
  targetLanguage: z.string().optional().default('en'),
  ...OutputOptionsSchema.shape,
});

export type TranslateInput = z.infer<typeof TranslateSchema>;
