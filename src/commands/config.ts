/**
 * Config management commands.
 */

import { Command } from 'commander';
import { initConfig, getConfiguredProviders, getConfigFilePath } from '../core/config.js';
import { listProviders } from '../providers/registry.js';
import { printResponse } from '../core/output.js';
import { toErrorResponse } from '../core/errors.js';
import { maskApiKey } from '../utils/env.js';
import { getProviderConfig } from '../core/config.js';

export function createConfigCommand(): Command {
  const config = new Command('config').description('Configuration management');

  config
    .command('init')
    .description('Initialize configuration directory and file')
    .option('--json', 'Output as JSON', false)
    .action((opts) => {
      try {
        const configPath = initConfig();
        printResponse({
          ok: true, type: 'config-init', provider: '',
          configFile: configPath,
          message: `Configuration initialized at ${configPath}`,
        }, opts.json);
      } catch (err) {
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  config
    .command('validate')
    .description('Validate configuration and show provider status')
    .option('--json', 'Output as JSON', false)
    .action(async (opts) => {
      try {
        const configuredIds = getConfiguredProviders();
        const allProviders = listProviders();

        const providerStatus = await Promise.all(
          allProviders.map(async (p) => {
            const validation = await p.validateConfig();
            const conf = getProviderConfig(p.id);
            return {
              id: p.id,
              name: p.name,
              configured: configuredIds.includes(p.id),
              valid: validation.valid,
              capabilities: p.capabilities,
              errors: validation.errors,
              warnings: validation.warnings,
              apiKey: conf?.apiKey ? maskApiKey(conf.apiKey) : undefined,
            };
          }),
        );

        if (opts.json) {
          console.log(JSON.stringify({
            ok: true,
            type: 'config-validate',
            configFile: getConfigFilePath(),
            providers: providerStatus,
            configuredCount: configuredIds.length,
            totalProviders: allProviders.length,
          }, null, 2));
        } else {
          console.log('Provider Configuration Status\n');
          console.log(`Config file: ${getConfigFilePath()}`);
          console.log(`Configured: ${configuredIds.length}/${allProviders.length} providers\n`);

          for (const p of providerStatus) {
            const status = p.configured ? '✓' : '✗';
            const key = p.apiKey ? ` (${p.apiKey})` : '';
            console.log(`  ${status} ${p.name}${key}`);
            if (p.configured) {
              console.log(`    Capabilities: ${p.capabilities.join(', ')}`);
            }
            if (p.errors.length > 0) {
              for (const e of p.errors) console.log(`    Error: ${e}`);
            }
            if (p.warnings.length > 0) {
              for (const w of p.warnings) console.log(`    Warning: ${w}`);
            }
          }
        }
      } catch (err) {
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  return config;
}
