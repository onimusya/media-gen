/**
 * Provider registry for media-gen-cli.
 * Central point for discovering and instantiating provider adapters.
 */

import type { FullProvider, ProviderCapability } from '../core/provider.js';
import { MediaGenError } from '../core/errors.js';
import { OpenAIProvider } from './openai/index.js';
import { GoogleProvider } from './google/index.js';
import { AzureProvider } from './azure/index.js';
import { ElevenLabsProvider } from './elevenlabs/index.js';
import { DeepgramProvider } from './deepgram/index.js';
import { FalProvider } from './fal/index.js';
import { LumaProvider } from './luma/index.js';
import { ReplicateProvider } from './replicate/index.js';
import { StabilityProvider } from './stability/index.js';
import { RunwayProvider } from './runway/index.js';
import { OpenRouterProvider } from './openrouter/index.js';
import { EdgeTTSProvider } from './edge-tts/index.js';
import { MinimaxProvider } from './minimax/index.js';

const providers: Map<string, FullProvider> = new Map();

function registerDefaults(): void {
  if (providers.size > 0) return;
  const all: FullProvider[] = [
    new OpenAIProvider(),
    new GoogleProvider(),
    new AzureProvider(),
    new ElevenLabsProvider(),
    new DeepgramProvider(),
    new FalProvider(),
    new LumaProvider(),
    new ReplicateProvider(),
    new StabilityProvider(),
    new RunwayProvider(),
    new OpenRouterProvider(),
    new EdgeTTSProvider(),
    new MinimaxProvider(),
  ];
  for (const p of all) {
    providers.set(p.id, p);
  }
}

export function getProvider(id: string): FullProvider {
  registerDefaults();
  const provider = providers.get(id);
  if (!provider) {
    throw new MediaGenError('PROVIDER_NOT_FOUND', `Unknown provider: "${id}"`, {
      suggestion: `Available providers: ${listProviderIds().join(', ')}`,
    });
  }
  return provider;
}

export function listProviders(): FullProvider[] {
  registerDefaults();
  return Array.from(providers.values());
}

export function listProviderIds(): string[] {
  registerDefaults();
  return Array.from(providers.keys());
}

export function getProvidersForCapability(capability: ProviderCapability): FullProvider[] {
  registerDefaults();
  return Array.from(providers.values()).filter((p) => p.capabilities.includes(capability));
}
