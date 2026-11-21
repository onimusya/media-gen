import { Command } from 'commander';
import { resolveModel, resolveProvider } from '../core/config.js';
import { MediaGenError, toErrorResponse } from '../core/errors.js';
import { validateMusicInput } from '../core/music.js';
import { checkOverwrite, printResponse, resolveOutputPath } from '../core/output.js';
import { getProvider } from '../providers/registry.js';

export function createMusicCommand(): Command {
  const music = new Command('music').description('Music generation');

  music
    .command('generate')
    .description('Generate an MP3 from a text prompt')
    .option('--provider <provider>', 'Music provider (google or elevenlabs)')
    .option('--model <model>', 'Music model to use')
    .option('--prompt <prompt>', 'Describe the music to generate')
    .option('--duration <seconds>', 'Track length in seconds (approximate for Google)')
    .option('--instrumental', 'Request music without vocals', false)
    .option('--output <path>', 'Output MP3 path')
    .option('--output-dir <dir>', 'Output directory')
    .option('--overwrite', 'Overwrite an existing file', false)
    .option('--allow-external-output', 'Allow output outside the project directory', false)
    .option('--dry-run', 'Validate without calling the provider', false)
    .option('--json', 'Output as JSON', false)
    .option('--debug', 'Enable debug logging', false)
    .action(async (opts) => {
      try {
        const providerName = resolveProvider(opts.provider, 'music');
        if (!providerName) {
          throw new MediaGenError('INVALID_INPUT', 'Use --provider or set MEDIA_GEN_MUSIC_PROVIDER.', {
            suggestion: 'Choose google or elevenlabs.',
          });
        }
        const provider = getProvider(providerName);
        if (!provider.generateMusic || !provider.defaultMusicModel) {
          throw new MediaGenError('CAPABILITY_NOT_SUPPORTED', `Provider "${providerName}" does not support music generation.`, {
            provider: providerName,
            suggestion: 'Choose google or elevenlabs.',
          });
        }

        const input = {
          model: resolveModel(opts.model, 'music') || provider.defaultMusicModel,
          prompt: opts.prompt || '',
          duration: opts.duration === undefined ? undefined : Number(opts.duration),
          instrumental: opts.instrumental,
          outputFile: resolveOutputPath(`music-${Date.now()}.mp3`, opts),
          overwrite: opts.overwrite,
        };
        validateMusicInput(input, providerName);
        checkOverwrite(input.outputFile, input.overwrite);

        const response = { ok: true as const, type: 'music', provider: providerName, model: input.model };
        if (opts.dryRun) {
          printResponse({ ...response, outputFile: input.outputFile, dryRun: true }, opts.json);
          return;
        }

        const result = await provider.generateMusic(input);
        printResponse({ ...response, ...result }, opts.json);
      } catch (error) {
        printResponse(toErrorResponse(error), opts.json);
        process.exitCode = 1;
      }
    });

  return music;
}
