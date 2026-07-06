/**
 * Common Zod schemas shared across media types.
 */

import { z } from 'zod';

export const ProviderIdSchema = z.enum([
  'openai',
  'google',
  'azure',
  'elevenlabs',
  'deepgram',
  'fal',
  'luma',
  'replicate',
  'stability',
  'runway',
  'minimax',
  'openrouter',
]);

export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const OutputOptionsSchema = z.object({
  output: z.string().optional(),
  outputDir: z.string().optional(),
  overwrite: z.boolean().default(false),
  metadata: z.boolean().default(false),
  json: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  allowExternalOutput: z.boolean().default(false),
});

export type OutputOptions = z.infer<typeof OutputOptionsSchema>;

export const AsyncOptionsSchema = z.object({
  wait: z.boolean().default(false),
  pollInterval: z.number().positive().default(5000),
  timeout: z.number().positive().default(600000),
});

export type AsyncOptions = z.infer<typeof AsyncOptionsSchema>;

export const GlobalOptionsSchema = z.object({
  debug: z.boolean().default(false),
  provider: ProviderIdSchema,
  model: z.string().optional(),
});

export type GlobalOptions = z.infer<typeof GlobalOptionsSchema>;
