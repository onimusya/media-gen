import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, isProviderConfigured, getConfiguredProviders, initConfig } from '../src/core/config.js';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

describe('Config', () => {
  const testDir = resolve(tmpdir(), `media-gen-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('loadConfig returns empty providers when no env vars or config file', () => {
    const originalEnv = { ...process.env };
    // Clear known env vars
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;

    const config = loadConfig(testDir);
    expect(config.providers).toBeDefined();
    expect(typeof config.providers).toBe('object');

    // Restore
    process.env = originalEnv;
  });

  it('loadConfig picks up environment variables', () => {
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key-12345';

    const config = loadConfig(testDir);
    expect(config.providers.openai?.apiKey).toBe('test-key-12345');

    // Restore
    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    else delete process.env.OPENAI_API_KEY;
  });

  it('isProviderConfigured returns true when API key is set', () => {
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key-xxx';

    expect(isProviderConfigured('openai', testDir)).toBe(true);
    expect(isProviderConfigured('elevenlabs', testDir)).toBe(false);

    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    else delete process.env.OPENAI_API_KEY;
  });

  it('getConfiguredProviders returns list of configured providers', () => {
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key-yyy';

    const providers = getConfiguredProviders(testDir);
    expect(providers).toContain('openai');

    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    else delete process.env.OPENAI_API_KEY;
  });

  it('initConfig creates config directory and file', () => {
    const configPath = initConfig(testDir);
    expect(existsSync(configPath)).toBe(true);
  });
});
