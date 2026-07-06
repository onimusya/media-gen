/**
 * Models configuration loader.
 * Reads from the bundled models.json and optionally merges with a user-level
 * config at .media-gen/models.json for customization.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import defaultModels from '../models.json' with { type: 'json' };

export interface ProviderModels {
  models: string[];
  capabilities: Record<string, string[]>;
}

export type ModelsConfig = Record<string, ProviderModels>;

/**
 * Load models config. Merges:
 * 1. Built-in models.json (bundled with CLI)
 * 2. User overrides at .media-gen/models.json (if exists)
 *
 * User config is merged per-provider: if a provider key exists in the user
 * file, it fully replaces the built-in entry for that provider.
 */
export function loadModelsConfig(cwd?: string): ModelsConfig {
  const config: ModelsConfig = { ...(defaultModels as unknown as ModelsConfig) };

  // Check for user-level overrides
  const userPath = resolve(cwd || process.cwd(), '.media-gen', 'models.json');
  if (existsSync(userPath)) {
    try {
      const raw = readFileSync(userPath, 'utf-8');
      const userConfig = JSON.parse(raw) as ModelsConfig;

      // Merge: user entries override built-in per provider
      for (const [provider, entry] of Object.entries(userConfig)) {
        config[provider] = entry;
      }
    } catch {
      // Invalid user models file, continue with defaults
    }
  }

  return config;
}

/**
 * Get models for a specific provider.
 */
export function getProviderModels(providerId: string, cwd?: string): ProviderModels | undefined {
  const config = loadModelsConfig(cwd);
  return config[providerId];
}

/**
 * Get models for a provider filtered by capability.
 */
export function getModelsForCapability(providerId: string, capability: string, cwd?: string): string[] {
  const entry = getProviderModels(providerId, cwd);
  if (!entry) return [];
  return entry.capabilities[capability] || [];
}
