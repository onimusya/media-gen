/**
 * Audio transcription and translation commands.
 */

import { Command } from 'commander';
import { getProvider } from '../providers/registry.js';
import { resolveOutputPath, checkOverwrite, ensureOutputDir, writeMetadata, printResponse } from '../core/output.js';
import { MediaGenError, toErrorResponse } from '../core/errors.js';
import { getLogger } from '../core/logger.js';
import { validateFileExists } from '../core/validation.js';
import { resolveProvider, resolveModel } from '../core/config.js';

export function createAudioCommand(): Command {
  const audio = new Command('audio').description('Audio transcription and translation');

  audio
    .command('transcribe')
    .description('Transcribe audio to text')
    .option('--provider <provider>', 'Provider (e.g., openai, deepgram, azure)')
    .requiredOption('--input <path>', 'Input audio file')
    .option('--model <model>', 'Transcription model')
    .option('--language <lang>', 'Audio language code')
    .option('--output <path>', 'Output file path')
    .option('--output-dir <dir>', 'Output directory')
    .option('--overwrite', 'Overwrite existing', false)
    .option('--metadata', 'Save metadata', false)
    .option('--json', 'Output as JSON', false)
    .option('--dry-run', 'Validate without calling provider', false)
    .option('--allow-external-output', 'Allow external output', false)
    .action(async (opts) => {
      const log = getLogger();
      try {
        validateFileExists(opts.input, 'Input audio');

        const providerName = resolveProvider(opts.provider, 'audio');
        const model = resolveModel(opts.model, 'audio');

        if (!providerName) {
          throw new MediaGenError('INVALID_INPUT', 'No provider specified. Use --provider or set MEDIA_GEN_DEFAULT_PROVIDER / MEDIA_GEN_AUDIO_PROVIDER in .env');
        }

        const outputFile = resolveOutputPath(
          opts.output ? opts.output.split(/[/\\]/).pop()! : `transcript-${Date.now()}.json`,
          { output: opts.output, outputDir: opts.outputDir, allowExternalOutput: opts.allowExternalOutput },
        );

        if (opts.dryRun) {
          printResponse({ ok: true, type: 'transcription', provider: providerName, outputFile, dryRun: true }, opts.json);
          return;
        }

        checkOverwrite(outputFile, opts.overwrite);
        ensureOutputDir(outputFile);

        const provider = getProvider(providerName);
        if (!provider.transcribe) {
          throw new MediaGenError('CAPABILITY_NOT_SUPPORTED', `Provider "${providerName}" does not support transcription`, {
            provider: providerName, suggestion: 'Try: openai, deepgram, azure',
          });
        }

        const result = await provider.transcribe({
          inputFile: opts.input, model, language: opts.language, outputFile,
        });

        let metadataFile: string | undefined;
        if (opts.metadata) {
          metadataFile = writeMetadata(outputFile, {
            provider: providerName, model, type: 'transcription',
            input: { file: opts.input, language: opts.language },
            outputFile, createdAt: new Date().toISOString(), durationMs: result.durationMs,
          });
        }

        printResponse({
          ok: true, type: 'transcription', provider: providerName, model,
          outputFile: result.outputFile, metadataFile, durationMs: result.durationMs,
          text: result.text.substring(0, 200) + (result.text.length > 200 ? '...' : ''),
        }, opts.json);
      } catch (err) {
        log.error(err, 'Transcribe error');
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  audio
    .command('translate')
    .description('Translate audio to another language')
    .option('--provider <provider>', 'Provider (e.g., openai, deepgram, azure)')
    .requiredOption('--input <path>', 'Input audio file')
    .option('--model <model>', 'Translation model')
    .option('--target-language <lang>', 'Target language', 'en')
    .option('--output <path>', 'Output file path')
    .option('--output-dir <dir>', 'Output directory')
    .option('--overwrite', 'Overwrite existing', false)
    .option('--json', 'Output as JSON', false)
    .option('--dry-run', 'Validate without calling provider', false)
    .action(async (opts) => {
      try {
        validateFileExists(opts.input, 'Input audio');

        const providerName = resolveProvider(opts.provider, 'audio');
        const model = resolveModel(opts.model, 'audio');

        if (!providerName) {
          throw new MediaGenError('INVALID_INPUT', 'No provider specified. Use --provider or set MEDIA_GEN_DEFAULT_PROVIDER / MEDIA_GEN_AUDIO_PROVIDER in .env');
        }

        const outputFile = resolveOutputPath(
          opts.output ? opts.output.split(/[/\\]/).pop()! : `translation-${Date.now()}.json`,
          { output: opts.output, outputDir: opts.outputDir },
        );

        if (opts.dryRun) {
          printResponse({ ok: true, type: 'translation', provider: providerName, outputFile, dryRun: true }, opts.json);
          return;
        }

        const provider = getProvider(providerName);
        if (!provider.translate) {
          throw new MediaGenError('CAPABILITY_NOT_SUPPORTED', `Provider "${providerName}" does not support translation`, {
            provider: providerName, suggestion: 'Try: openai, deepgram, azure',
          });
        }

        const result = await provider.translate({
          inputFile: opts.input, model,
          targetLanguage: opts.targetLanguage, outputFile,
        });

        printResponse({
          ok: true, type: 'translation', provider: providerName,
          outputFile: result.outputFile, durationMs: result.durationMs,
        }, opts.json);
      } catch (err) {
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  return audio;
}
