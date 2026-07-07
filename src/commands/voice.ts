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

export function createVoiceCommand(): Command {
  const voice = new Command('voice').description('Voice synthesis and cloning');

  voice
    .command('tts')
    .description('Convert text to speech')
    .option('--provider <provider>', 'Provider (e.g., openai, elevenlabs, edge-tts, azure)')
    .option('--voice-id <id>', 'Voice ID to use (or set MEDIA_GEN_VOICE_ID in .env)')
    .requiredOption('--text <text>', 'Text to convert to speech')
    .option('--model <model>', 'TTS model')
    .option('--speed <speed>', 'Playback speed multiplier')
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
