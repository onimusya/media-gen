import { describe, it, expect } from 'vitest';
import { listProviders, getProvider, getProvidersForCapability } from '../src/providers/registry.js';
import { MediaGenError } from '../src/core/errors.js';

describe('Provider Registry', () => {
  it('lists all providers', () => {
    const providers = listProviders();
    expect(providers.length).toBeGreaterThanOrEqual(10);
    const ids = providers.map((p) => p.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('google');
    expect(ids).toContain('azure');
    expect(ids).toContain('elevenlabs');
    expect(ids).toContain('deepgram');
    expect(ids).toContain('fal');
    expect(ids).toContain('luma');
    expect(ids).toContain('replicate');
    expect(ids).toContain('stability');
    expect(ids).toContain('runway');
  });

  it('gets a specific provider', () => {
    const openai = getProvider('openai');
    expect(openai.id).toBe('openai');
    expect(openai.name).toBe('OpenAI');
    expect(openai.capabilities).toContain('image-generate');
  });

  it('throws for unknown provider', () => {
    expect(() => getProvider('nonexistent')).toThrow(MediaGenError);
  });

  it('filters providers by capability: image-generate', () => {
    const providers = getProvidersForCapability('image-generate');
    const ids = providers.map((p) => p.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('stability');
    expect(ids).toContain('fal');
    expect(ids).toContain('replicate');
    expect(ids).not.toContain('deepgram');
  });

  it('filters providers by capability: audio-transcribe', () => {
    const providers = getProvidersForCapability('audio-transcribe');
    const ids = providers.map((p) => p.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('deepgram');
    expect(ids).not.toContain('stability');
  });

  it('filters providers by capability: voice-tts', () => {
    const providers = getProvidersForCapability('voice-tts');
    const ids = providers.map((p) => p.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('elevenlabs');
    expect(ids).toContain('azure');
  });

  it('filters providers by capability: video-generate', () => {
    const providers = getProvidersForCapability('video-generate');
    const ids = providers.map((p) => p.id);
    expect(ids).toContain('google');
    expect(ids).toContain('luma');
    expect(ids).toContain('runway');
    expect(ids).toContain('fal');
  });

  it('each provider has valid capabilities array', () => {
    const providers = listProviders();
    for (const p of providers) {
      expect(Array.isArray(p.capabilities)).toBe(true);
      expect(p.capabilities.length).toBeGreaterThan(0);
    }
  });

  it('each provider has validateConfig method', () => {
    const providers = listProviders();
    for (const p of providers) {
      expect(typeof p.validateConfig).toBe('function');
    }
  });
});

describe('Provider Validation', () => {
  it('openai validateConfig reports missing key when unset', async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    const originalHome = process.env.MEDIA_GEN_HOME;
    delete process.env.OPENAI_API_KEY;
    // Point home to a non-existent dir so ~/.media-gen/.env doesn't load
    process.env.MEDIA_GEN_HOME = '/tmp/media-gen-test-nonexistent';

    const { isProviderConfigured } = await import('../src/core/config.js');
    const configured = isProviderConfigured('openai', '/tmp/media-gen-test-nonexistent');
    expect(configured).toBe(false);

    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    if (originalHome) process.env.MEDIA_GEN_HOME = originalHome;
    else delete process.env.MEDIA_GEN_HOME;
  });

  it('openai validateConfig passes with key set', async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';

    const provider = getProvider('openai');
    const result = await provider.validateConfig();
    expect(result.valid).toBe(true);

    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    else delete process.env.OPENAI_API_KEY;
  });
});
