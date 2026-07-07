/**
 * Configuration loader for media-gen-cli.
 * Reads from environment variables and .media-gen/config.json.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
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
    voiceId?: string;
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

export function getHomeConfigDir(): string {
  // Allow override for testing
  if (process.env.MEDIA_GEN_HOME) {
    return process.env.MEDIA_GEN_HOME;
  }
  return join(homedir(), '.media-gen');
}

export function getConfigDir(cwd?: string): string {
  return resolve(cwd || process.cwd(), CONFIG_DIR);
}

export function getConfigFilePath(cwd?: string): string {
  return join(getConfigDir(cwd), CONFIG_FILE);
}

export function loadConfig(cwd?: string): MediaGenConfig {
  const workDir = cwd || process.cwd();
  const homeDir = getHomeConfigDir();

  // Load .env hierarchy (loaded in order, each overrides the previous):
  // 1. ~/.media-gen/.env (user-level, overrides system env vars)
  // 2. <project>/.env (project-level, overrides home config)
  // Both use override:true. Since project loads last, it has final authority.

  const homeEnv = join(homeDir, '.env');
  if (existsSync(homeEnv)) {
    loadDotenv({ path: homeEnv, override: true });
  }

  const projectEnv = resolve(workDir, '.env');
  if (existsSync(projectEnv)) {
    loadDotenv({ path: projectEnv, override: true });
  }

  const config: MediaGenConfig = { providers: {} };

  // Load config.json hierarchy (merged, project overrides home):
  // 1. ~/.media-gen/config.json (user-level defaults)
  const homeConfigPath = join(homeDir, CONFIG_FILE);
  if (existsSync(homeConfigPath)) {
    try {
      const raw = readFileSync(homeConfigPath, 'utf-8');
      const homeConfig = JSON.parse(raw) as Partial<MediaGenConfig>;
      if (homeConfig.providers) {
        config.providers = { ...homeConfig.providers };
      }
      if (homeConfig.defaults) {
        config.defaults = { ...homeConfig.defaults };
      }
    } catch {
      // Invalid home config file, skip
    }
  }

  // 2. <project>/.media-gen/config.json (project-level overrides)
  const projectConfigPath = getConfigFilePath(workDir);
  if (existsSync(projectConfigPath)) {
    try {
      const raw = readFileSync(projectConfigPath, 'utf-8');
      const projectConfig = JSON.parse(raw) as Partial<MediaGenConfig>;
      if (projectConfig.providers) {
        // Merge per-provider (project overrides home per key)
        for (const [id, provConf] of Object.entries(projectConfig.providers)) {
          config.providers[id] = { ...config.providers[id], ...provConf };
        }
      }
      if (projectConfig.defaults) {
        config.defaults = { ...config.defaults, ...projectConfig.defaults };
      }
    } catch {
      // Invalid project config file, skip
    }
  }

  // 3. Environment variables (highest precedence after .env loading)
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

// Providers that don't require an API key
const KEYLESS_PROVIDERS = new Set(['edge-tts']);

export function isProviderConfigured(providerId: string, cwd?: string): boolean {
  if (KEYLESS_PROVIDERS.has(providerId)) return true;
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

/**
 * Initialize user-level config at ~/.media-gen/
 */
export function initHomeConfig(): string {
  const homeDir = getHomeConfigDir();
  const configPath = join(homeDir, CONFIG_FILE);

  if (!existsSync(homeDir)) {
    mkdirSync(homeDir, { recursive: true });
  }

  if (existsSync(configPath)) {
    return configPath;
  }

  const defaultConfig: MediaGenConfig = {
    providers: {},
    defaults: {},
  };

  writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');

  // Also create a template .env
  const envPath = join(homeDir, '.env');
  if (!existsSync(envPath)) {
    const template = `# media-gen-cli user-level configuration
# API keys here apply to all projects unless overridden by a project .env

OPENAI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
ELEVENLABS_API_KEY=
DEEPGRAM_API_KEY=
OPENROUTER_API_KEY=

# Default provider/model
MEDIA_GEN_DEFAULT_PROVIDER=
MEDIA_GEN_DEFAULT_MODEL=
`;
    writeFileSync(envPath, template, 'utf-8');
  }

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

/**
 * Resolve voice ID for TTS commands.
 * Priority: CLI arg > MEDIA_GEN_VOICE_ID env var > config file defaults.voiceId
 */
export function resolveVoiceId(cliVoiceId: string | undefined, cwd?: string): string | undefined {
  if (cliVoiceId) return cliVoiceId;
  const envVoiceId = process.env['MEDIA_GEN_VOICE_ID'];
  if (envVoiceId) return envVoiceId;
  const config = loadConfig(cwd);
  return config.defaults?.voiceId || undefined;
}
