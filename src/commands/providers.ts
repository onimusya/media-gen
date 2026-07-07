/**
 * Provider listing commands.
 */

import { Command } from 'commander';
import { listProviders, getProvidersForCapability } from '../providers/registry.js';
import { isProviderConfigured } from '../core/config.js';
import { loadModelsConfig } from '../core/models.js';
import type { ProviderCapability } from '../core/provider.js';

export function createProvidersCommand(): Command {
  const providers = new Command('providers').description('List providers and models');

  providers
    .command('list')
    .description('List all supported providers with their capabilities and models')
    .option('--json', 'Output as JSON', false)
    .option('--capability <cap>', 'Filter by capability (e.g., image-generate, video-generate, voice-tts, audio-transcribe)')
    .option('--configured', 'Only show configured providers', false)
    .action((opts) => {
      const modelsConfig = loadModelsConfig();
      let result = listProviders();

      if (opts.capability) {
        result = getProvidersForCapability(opts.capability as ProviderCapability);
      }

      const data = result
        .map((p) => ({
          id: p.id,
          name: p.name,
          configured: isProviderConfigured(p.id),
          capabilities: p.capabilities,
          models: modelsConfig[p.id]?.models || [],
          voiceIds: modelsConfig[p.id]?.voiceIds || [],
        }))
        .filter((p) => !opts.configured || p.configured);

      if (opts.json) {
        console.log(JSON.stringify({ ok: true, providers: data }, null, 2));
      } else {
        console.log('Supported Providers:\n');
        for (const p of data) {
          const status = p.configured ? '✓' : '✗';
          console.log(`  ${status} ${p.name} (${p.id})`);
          console.log(`    Capabilities: ${p.capabilities.join(', ')}`);
          if (p.models.length > 0) {
            console.log(`    Models: ${p.models.join(', ')}`);
          }
          if (p.voiceIds.length > 0) {
            console.log(`    Voices: ${p.voiceIds.join(', ')}`);
          }
        }
        console.log(`\n  Total: ${data.length} providers (${data.filter((p) => p.configured).length} configured)`);
      }
    });

  providers
    .command('models')
    .description('List models for a provider (or all providers if --provider is omitted)')
    .option('--provider <id>', 'Provider ID (omit to show all)')
    .option('--capability <cap>', 'Filter models by capability')
    .option('--json', 'Output as JSON', false)
    .action((opts) => {
      const modelsConfig = loadModelsConfig();

      if (opts.provider) {
        const entry = modelsConfig[opts.provider];
        let models: string[];

        if (opts.capability && entry?.capabilities) {
          models = entry.capabilities[opts.capability] || [];
        } else {
          models = entry?.models || [];
        }

        const voiceIds = entry?.voiceIds || [];

        if (opts.json) {
          const result: Record<string, unknown> = { ok: true, provider: opts.provider, models };
          if (voiceIds.length > 0) result.voiceIds = voiceIds;
          console.log(JSON.stringify(result, null, 2));
        } else {
          if (models.length > 0) {
            console.log(`Models for ${opts.provider}:\n`);
            for (const m of models) {
              console.log(`  - ${m}`);
            }
          }
          if (voiceIds.length > 0) {
            console.log(`Voices for ${opts.provider}:\n`);
            for (const v of voiceIds) {
              console.log(`  - ${v}`);
            }
          }
          if (models.length === 0 && voiceIds.length === 0) {
            console.log(`  No predefined models or voices. Check provider documentation.`);
          }
        }
      } else {
        // All providers
        const allData: Record<string, { models: string[]; voiceIds: string[]; configured: boolean }> = {};
        for (const p of listProviders()) {
          const entry = modelsConfig[p.id];
          let models: string[];

          if (opts.capability && entry?.capabilities) {
            models = entry.capabilities[opts.capability] || [];
          } else {
            models = entry?.models || [];
          }

          const voiceIds = entry?.voiceIds || [];

          if (models.length > 0 || voiceIds.length > 0 || !opts.capability) {
            allData[p.id] = { models, voiceIds, configured: isProviderConfigured(p.id) };
          }
        }

        if (opts.json) {
          console.log(JSON.stringify({ ok: true, providers: allData }, null, 2));
        } else {
          console.log('All Provider Models:\n');
          for (const [id, info] of Object.entries(allData)) {
            const status = info.configured ? '✓' : '✗';
            console.log(`  ${status} ${id}`);
            for (const m of info.models) {
              console.log(`      ${m}`);
            }
            if (info.voiceIds.length > 0) {
              console.log(`    Voices:`);
              for (const v of info.voiceIds) {
                console.log(`      ${v}`);
              }
            }
            if (info.models.length === 0 && info.voiceIds.length === 0) {
              console.log('      (no predefined models)');
            }
          }
        }
      }
    });

  return providers;
}
