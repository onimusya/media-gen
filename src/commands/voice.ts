/**
 * Voice/TTS commands.
 */

import { Command } from 'commander';
import { getProvider } from '../providers/registry.js';
import { resolveOutputPath, checkOverwrite, ensureOutputDir, writeMetadata, printResponse } from '../core/output.js';
import { MediaGenError, toErrorResponse } from '../core/errors.js';
import { getLogger } from '../core/logger.js';
import { validateFileExists } from '../core/validation.js';
import { resolveProvider, resolveModel, resolveVoiceId } from '../core/config.js';
import { parseBatchFile, runBatch } from '../utils/batch.js';

export function createVoiceCommand(): Command {
  const voice = new Command('voice').description('Voice synthesis and cloning');

  voice
    .command('tts')
    .description('Convert text to speech')
    .option('--provider <provider>', 'Provider (e.g., openai, elevenlabs, edge-tts, azure)')
    .option('--voice-id <id>', 'Voice ID to use (or set MEDIA_GEN_VOICE_ID in .env)')
    .option('--text <text>', 'Text to convert to speech')
    .option('--batch <file>', 'Batch file with texts (.txt, .json, .csv)')
    .option('--model <model>', 'TTS model')
    .option('--speed <speed>', 'Playback speed multiplier')
    .option('--instructions <text>', 'Voice style instructions (OpenAI gpt-4o-mini-tts only)')
    .option('--format <format>', 'Output format (mp3, wav, ogg, flac)')
    .option('--output <path>', 'Output file path')
    .option('--output-dir <dir>', 'Output directory')
    .option('--overwrite', 'Overwrite existing files', false)
    .option('--metadata', 'Save metadata JSON', false)
    .option('--json', 'Output as JSON', false)
    .option('--dry-run', 'Validate without calling provider', false)
    .option('--allow-external-output', 'Allow output outside project', false)
    .option('--debug', 'Enable debug logging', false)
    .action(async (opts) => {
      const log = getLogger();

      // Batch mode
      if (opts.batch) {
        try {
          const items = parseBatchFile(opts.batch);
          if (items.length === 0) {
            throw new MediaGenError('INVALID_INPUT', 'Batch file is empty');
          }

          const providerName = resolveProvider(opts.provider, 'voice');
          const model = resolveModel(opts.model, 'voice');
          const voiceId = resolveVoiceId(opts.voiceId);

          if (!providerName) {
            throw new MediaGenError('INVALID_INPUT', 'No provider specified. Use --provider or set MEDIA_GEN_VOICE_PROVIDER in .env');
          }
          if (!voiceId) {
            throw new MediaGenError('INVALID_INPUT', 'No voice ID specified. Use --voice-id or set MEDIA_GEN_VOICE_ID in .env');
          }

          if (opts.dryRun) {
            printResponse({ ok: true, type: 'batch-tts', provider: providerName, model, voiceId, items: items.length, dryRun: true }, opts.json);
            return;
          }

          const provider = getProvider(providerName);
          if (!provider.textToSpeech) {
            throw new MediaGenError('CAPABILITY_NOT_SUPPORTED', `Provider "${providerName}" does not support TTS`, { provider: providerName });
          }

          const ext = opts.format || 'mp3';
          const results = await runBatch(items, async (item, index) => {
            const outputFile = resolveOutputPath(
              item.output || `tts-batch-${index + 1}-${Date.now()}.${ext}`,
              { outputDir: opts.outputDir || './outputs', allowExternalOutput: opts.allowExternalOutput },
            );
            checkOverwrite(outputFile, opts.overwrite);
            ensureOutputDir(outputFile);

            const result = await provider.textToSpeech!({
              text: item.prompt,
              voiceId: item.voiceId || voiceId,
              model,
              speed: opts.speed ? parseFloat(opts.speed) : undefined,
              format: opts.format,
              instructions: opts.instructions,
              outputFile,
            });
            return { outputFile: result.outputFile };
          }, {
            onProgress: (completed, total, result) => {
              if (!opts.json) {
                const status = result.ok ? '✓' : '✗';
                console.log(`  ${status} [${completed}/${total}] ${result.prompt.substring(0, 60)}${result.prompt.length > 60 ? '...' : ''}`);
              }
            },
          });

          const succeeded = results.filter((r) => r.ok).length;
          const failed = results.filter((r) => !r.ok).length;

          if (opts.json) {
            console.log(JSON.stringify({ ok: true, type: 'batch-tts', provider: providerName, model, voiceId, total: items.length, succeeded, failed, results }, null, 2));
          } else {
            console.log(`\nBatch complete: ${succeeded} succeeded, ${failed} failed out of ${items.length}`);
          }
        } catch (err) {
          log.error(err, 'Batch TTS error');
          printResponse(toErrorResponse(err), opts.json);
          process.exitCode = 1;
        }
        return;
      }

      // Single mode
      if (!opts.text) {
        printResponse(toErrorResponse(new MediaGenError('INVALID_INPUT', 'Either --text or --batch is required')), opts.json);
        process.exitCode = 1;
        return;
      }

      try {
        const providerName = resolveProvider(opts.provider, 'voice');
        const model = resolveModel(opts.model, 'voice');
        const voiceId = resolveVoiceId(opts.voiceId);

        if (!providerName) {
          throw new MediaGenError('INVALID_INPUT', 'No provider specified. Use --provider or set MEDIA_GEN_DEFAULT_PROVIDER / MEDIA_GEN_VOICE_PROVIDER in .env');
        }

        if (!voiceId) {
          throw new MediaGenError('INVALID_INPUT', 'No voice ID specified. Use --voice-id or set MEDIA_GEN_VOICE_ID in .env');
        }

        const ext = opts.format || 'mp3';
        const outputFile = resolveOutputPath(
          opts.output ? opts.output.split(/[/\\]/).pop()! : `speech-${Date.now()}.${ext}`,
          { output: opts.output, outputDir: opts.outputDir, allowExternalOutput: opts.allowExternalOutput },
        );

        if (opts.dryRun) {
          printResponse({ ok: true, type: 'tts', provider: providerName, model, voiceId, outputFile, dryRun: true }, opts.json);
          return;
        }

        checkOverwrite(outputFile, opts.overwrite);
        ensureOutputDir(outputFile);

        const provider = getProvider(providerName);
        if (!provider.textToSpeech) {
          throw new MediaGenError('CAPABILITY_NOT_SUPPORTED', `Provider "${providerName}" does not support TTS`, {
            provider: providerName,
            suggestion: 'Try: openai, elevenlabs, azure',
          });
        }

        const result = await provider.textToSpeech({
          text: opts.text,
          voiceId,
          model,
          speed: opts.speed ? parseFloat(opts.speed) : undefined,
          format: opts.format,
          instructions: opts.instructions,
          outputFile,
        });

        let metadataFile: string | undefined;
        if (opts.metadata) {
          metadataFile = writeMetadata(outputFile, {
            provider: providerName, model, type: 'tts',
            input: { text: opts.text, voiceId },
            outputFile: result.outputFile, createdAt: new Date().toISOString(),
            durationMs: result.durationMs,
          });
        }

        printResponse({
          ok: true, type: 'tts', provider: providerName, model,
          outputFile: result.outputFile, metadataFile, durationMs: result.durationMs,
        }, opts.json);

      } catch (err) {
        log.error(err, 'TTS error');
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  voice
    .command('clone')
    .description('Clone a voice from audio samples')
    .requiredOption('--provider <provider>', 'Provider (e.g., elevenlabs)')
    .requiredOption('--name <name>', 'Name for the cloned voice')
    .requiredOption('--files <paths...>', 'Audio sample file paths')
    .option('--description <desc>', 'Voice description')
    .option('--json', 'Output as JSON', false)
    .option('--dry-run', 'Validate without calling provider', false)
    .action(async (opts) => {
      try {
        for (const file of opts.files) {
          validateFileExists(file, 'Audio sample');
        }

        if (opts.dryRun) {
          printResponse({ ok: true, type: 'voice-clone', provider: opts.provider, dryRun: true, name: opts.name }, opts.json);
          return;
        }

        const provider = getProvider(opts.provider);
        if (!provider.cloneVoice) {
          throw new MediaGenError('CAPABILITY_NOT_SUPPORTED', `Provider "${opts.provider}" does not support voice cloning`, {
            provider: opts.provider, suggestion: 'Try: elevenlabs',
          });
        }

        const result = await provider.cloneVoice({
          name: opts.name,
          files: opts.files,
          description: opts.description,
        });

        printResponse({
          ok: true, type: 'voice-clone', provider: opts.provider,
          voiceId: result.voiceId, voiceName: result.name,
        }, opts.json);

      } catch (err) {
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  voice
    .command('isolate')
    .description('Isolate voice from background audio')
    .requiredOption('--provider <provider>', 'Provider (e.g., elevenlabs)')
    .requiredOption('--input <path>', 'Input audio file')
    .option('--output <path>', 'Output file path')
    .option('--output-dir <dir>', 'Output directory')
    .option('--overwrite', 'Overwrite existing files', false)
    .option('--json', 'Output as JSON', false)
    .option('--dry-run', 'Validate without calling provider', false)
    .action(async (opts) => {
      try {
        validateFileExists(opts.input, 'Input audio');

        const outputFile = resolveOutputPath(
          opts.output ? opts.output.split(/[/\\]/).pop()! : `isolated-${Date.now()}.mp3`,
          { output: opts.output, outputDir: opts.outputDir },
        );

        if (opts.dryRun) {
          printResponse({ ok: true, type: 'voice-isolate', provider: opts.provider, outputFile, dryRun: true }, opts.json);
          return;
        }

        const provider = getProvider(opts.provider);
        if (!provider.isolateVoice) {
          throw new MediaGenError('CAPABILITY_NOT_SUPPORTED', `Provider "${opts.provider}" does not support voice isolation`, {
            provider: opts.provider, suggestion: 'Try: elevenlabs',
          });
        }

        const result = await provider.isolateVoice({ inputFile: opts.input, outputFile });
        printResponse({
          ok: true, type: 'voice-isolate', provider: opts.provider,
          outputFile: result.outputFile, durationMs: result.durationMs,
        }, opts.json);

      } catch (err) {
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  return voice;
}
