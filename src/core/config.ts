/**
 * Configuration loader for media-gen-cli.
 * Reads from environment variables and .media-gen/config.json.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { config as loadDotenv } from 'dotenv';

export interface ProviderConfig {
  apiKey?: string;
  endpoint?: string;
  apiVersion?: string;
  [key: string]: string | undefined;
}

export interface MediaGenConfig {
  providers: Record<string, ProviderConfig>;
  defaults?: {
    outputDir?: string;
    imageProvider?: string;
    imageModel?: string;
    videoProvider?: string;
    videoModel?: string;
    voiceProvider?: string;
    voiceModel?: string;
    audioProvider?: string;
    audioModel?: string;
  };
}

const CONFIG_DIR = '.media-gen';
const CONFIG_FILE = 'config.json';

const ENV_KEY_MAP: Record<string, Record<string, string>> = {
  openai: { apiKey: 'OPENAI_API_KEY' },
  google: { apiKey: 'GOOGLE_GENERATIVE_AI_API_KEY' },
  azure: {
    apiKey: 'AZURE_OPENAI_API_KEY',
    endpoint: 'AZURE_OPENAI_ENDPOINT',
    apiVersion: 'AZURE_OPENAI_API_VERSION',
  },
  elevenlabs: { apiKey: 'ELEVENLABS_API_KEY' },
  deepgram: { apiKey: 'DEEPGRAM_API_KEY' },
  fal: { apiKey: 'FAL_KEY' },
  luma: { apiKey: 'LUMA_API_KEY' },
  replicate: { apiKey: 'REPLICATE_API_TOKEN' },
  stability: { apiKey: 'STABILITY_API_KEY' },
  runway: { apiKey: 'RUNWAY_API_KEY' },
  minimax: { apiKey: 'MINIMAX_API_KEY' },
  openrouter: { apiKey: 'OPENROUTER_API_KEY' },
};

export function getConfigDir(cwd?: string): string {
  return resolve(cwd || process.cwd(), CONFIG_DIR);
}

export function getConfigFilePath(cwd?: string): string {
  return join(getConfigDir(cwd), CONFIG_FILE);
}

export function loadConfig(cwd?: string): MediaGenConfig {
  // Load .env file if present — override system env vars so project-local
  // .env is the source of truth for this CLI
  loadDotenv({ path: resolve(cwd || process.cwd(), '.env'), override: true });

  const config: MediaGenConfig = { providers: {} };

  // Load from config file if exists
  const configPath = getConfigFilePath(cwd);
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      const fileConfig = JSON.parse(raw) as Partial<MediaGenConfig>;
      if (fileConfig.providers) {
        config.providers = { ...fileConfig.providers };
      }
      if (fileConfig.defaults) {
        config.defaults = { ...fileConfig.defaults };
      }
    } catch {
      // Invalid config file, continue with env vars
    }
  }

  // Overlay environment variables (take precedence)
  for (const [providerId, envKeys] of Object.entries(ENV_KEY_MAP)) {
    for (const [field, envVar] of Object.entries(envKeys)) {
      const value = process.env[envVar];
      if (value) {
        if (!config.providers[providerId]) {
          config.providers[providerId] = {};
        }
        config.providers[providerId][field] = value;
      }
    }
  }

  return config;
}

export function getProviderConfig(providerId: string, cwd?: string): ProviderConfig | undefined {
  const config = loadConfig(cwd);
  return config.providers[providerId];
}

export function isProviderConfigured(providerId: string, cwd?: string): boolean {
  const config = getProviderConfig(providerId, cwd);
  return !!config?.apiKey;
}

export function getConfiguredProviders(cwd?: string): string[] {
  const config = loadConfig(cwd);
  return Object.entries(config.providers)
    .filter(([_, conf]) => !!conf.apiKey)
    .map(([id]) => id);
}

export function initConfig(cwd?: string): string {
  const configDir = getConfigDir(cwd);
  const configPath = getConfigFilePath(cwd);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  if (existsSync(configPath)) {
    return configPath;
  }

  const defaultConfig: MediaGenConfig = {
    providers: {},
    defaults: {
      outputDir: './outputs',
    },
  };

  writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  return configPath;
}

export function getEnvKeyMap(): Record<string, Record<string, string>> {
  return ENV_KEY_MAP;
}

/**
 * Resolve default provider/model for a given media type.
 * Priority: CLI arg > type-specific env > global env > config file defaults.
 */
export type MediaType = 'image' | 'video' | 'voice' | 'audio';

export interface DefaultsResult {
  provider?: string;
  model?: string;
}

export function getDefaults(mediaType: MediaType, cwd?: string): DefaultsResult {
  const config = loadConfig(cwd);

  // Type-specific env vars take highest priority
  const typeUpper = mediaType.toUpperCase();
  const typeProvider = process.env[`MEDIA_GEN_${typeUpper}_PROVIDER`];
  const typeModel = process.env[`MEDIA_GEN_${typeUpper}_MODEL`];

  // Global env vars
  const globalProvider = process.env['MEDIA_GEN_DEFAULT_PROVIDER'];
  const globalModel = process.env['MEDIA_GEN_DEFAULT_MODEL'];

  // Config file defaults
  const configProvider = config.defaults?.[`${mediaType}Provider` as keyof typeof config.defaults] as string | undefined;
  const configModel = config.defaults?.[`${mediaType}Model` as keyof typeof config.defaults] as string | undefined;

  return {
    provider: typeProvider || globalProvider || configProvider || undefined,
    model: typeModel || globalModel || configModel || undefined,
  };
}

/**
 * Resolve provider for a command — uses CLI arg if provided, else falls back to defaults.
 */
export function resolveProvider(cliProvider: string | undefined, mediaType: MediaType, cwd?: string): string | undefined {
  if (cliProvider) return cliProvider;
  return getDefaults(mediaType, cwd).provider;
}

/**
 * Resolve model for a command — uses CLI arg if provided, else falls back to defaults.
 */
export function resolveModel(cliModel: string | undefined, mediaType: MediaType, cwd?: string): string | undefined {
  if (cliModel) return cliModel;
  return getDefaults(mediaType, cwd).model;
}
