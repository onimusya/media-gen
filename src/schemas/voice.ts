/**
 * Zod schemas for voice/TTS inputs.
 */

import { z } from 'zod';
import { ProviderIdSchema, OutputOptionsSchema } from './common.js';

export const TTSFormatSchema = z.enum(['mp3', 'wav', 'ogg', 'flac', 'aac', 'pcm']);

export const TextToSpeechSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().optional(),
  voiceId: z.string().min(1, 'Voice ID is required'),
  text: z.string().min(1, 'Text is required'),
  speed: z.number().positive().optional(),
  format: TTSFormatSchema.optional(),
  ...OutputOptionsSchema.shape,
});

export type TextToSpeechInput = z.infer<typeof TextToSpeechSchema>;

export const VoiceCloneSchema = z.object({
  provider: ProviderIdSchema,
  name: z.string().min(1, 'Voice name is required'),
  files: z.array(z.string()).min(1, 'At least one audio file is required'),
  description: z.string().optional(),
});

export type VoiceCloneInput = z.infer<typeof VoiceCloneSchema>;

export const VoiceIsolateSchema = z.object({
  provider: ProviderIdSchema,
  input: z.string().min(1, 'Input file path is required'),
  ...OutputOptionsSchema.shape,
});

export type VoiceIsolateInput = z.infer<typeof VoiceIsolateSchema>;
