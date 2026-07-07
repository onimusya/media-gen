/**
 * Video generation commands.
 */

import { Command } from 'commander';
import { getProvider } from '../providers/registry.js';
import { resolveOutputPath, checkOverwrite, ensureOutputDir, writeMetadata, printResponse } from '../core/output.js';
import { MediaGenError, toErrorResponse } from '../core/errors.js';
import { isAsyncResult, pollForCompletion } from '../core/jobs.js';
import { getLogger } from '../core/logger.js';
import { validateFileExists } from '../core/validation.js';
import { resolveProvider, resolveModel } from '../core/config.js';
import type { SuccessResponse } from '../core/errors.js';

export function createVideoCommand(): Command {
  const video = new Command('video').description('Video generation');

  video
    .command('generate')
    .description('Generate a video from a text prompt')
    .requiredOption('--prompt <prompt>', 'Video generation prompt')
    .option('--provider <provider>', 'Provider to use (e.g., google, luma, runway, fal)')
    .option('--model <model>', 'Model to use')
    .option('--duration <seconds>', 'Video duration in seconds')
    .option('--aspect-ratio <ratio>', 'Aspect ratio (e.g., 16:9)')
    .option('--resolution <res>', 'Resolution (e.g., 1080p)')
    .option('--fps <fps>', 'Frames per second')
    .option('--output <path>', 'Output file path')
    .option('--output-dir <dir>', 'Output directory')
    .option('--overwrite', 'Overwrite existing files', false)
    .option('--metadata', 'Save metadata JSON', false)
    .option('--json', 'Output as JSON', false)
    .option('--dry-run', 'Validate without calling provider', false)
    .option('--wait', 'Wait for async job to complete', false)
    .option('--poll-interval <ms>', 'Polling interval in ms', '5000')
    .option('--timeout <ms>', 'Max wait time in ms', '600000')
    .option('--allow-external-output', 'Allow output outside project dir', false)
    .option('--debug', 'Enable debug logging', false)
    .action(async (opts) => {
      const log = getLogger();
      try {
        const providerName = resolveProvider(opts.provider, 'video');
        const model = resolveModel(opts.model, 'video');

        if (!providerName) {
          throw new MediaGenError('INVALID_INPUT', 'No provider specified. Use --provider or set MEDIA_GEN_DEFAULT_PROVIDER / MEDIA_GEN_VIDEO_PROVIDER in .env');
        }
        if (!model) {
          throw new MediaGenError('INVALID_INPUT', 'No model specified. Use --model or set MEDIA_GEN_DEFAULT_MODEL / MEDIA_GEN_VIDEO_MODEL in .env');
        }

        const outputFile = resolveOutputPath(
          opts.output ? opts.output.split(/[/\\]/).pop()! : `video-${Date.now()}.mp4`,
          { output: opts.output, outputDir: opts.outputDir, allowExternalOutput: opts.allowExternalOutput },
        );

        if (opts.dryRun) {
          printResponse({
            ok: true, type: 'video', provider: providerName, model, outputFile, dryRun: true,
          }, opts.json);
          return;
        }

        checkOverwrite(outputFile, opts.overwrite);
        ensureOutputDir(outputFile);

        const provider = getProvider(providerName);
        if (!provider.generateVideo) {
          throw new MediaGenError('CAPABILITY_NOT_SUPPORTED', `Provider "${opts.provider}" does not support video generation`, {
            provider: opts.provider,
            suggestion: 'Try: google, luma, runway, fal, replicate',
          });
        }

        const result = await provider.generateVideo({
          prompt: opts.prompt,
          model: opts.model,
          duration: opts.duration ? parseFloat(opts.duration) : undefined,
          aspectRatio: opts.aspectRatio,
          resolution: opts.resolution,
          fps: opts.fps ? parseInt(opts.fps) : undefined,
          outputFile,
        });

        if (isAsyncResult(result)) {
          if (opts.wait && provider.getJobStatus && provider.downloadJob) {
            const status = await pollForCompletion(
              result.jobId,
              opts.provider,
              (id) => provider.getJobStatus!(id),
              { wait: true, pollInterval: parseInt(opts.pollInterval), timeout: parseInt(opts.timeout) },
            );

            if (status.status === 'completed') {
              const mediaResult = await provider.downloadJob!(result.jobId, outputFile);
              let metadataFile: string | undefined;
              if (opts.metadata) {
                metadataFile = writeMetadata(outputFile, {
                  provider: opts.provider, model: opts.model, type: 'video',
                  prompt: opts.prompt, outputFile, createdAt: new Date().toISOString(),
                  durationMs: mediaResult.durationMs, jobId: result.jobId,
                });
              }
              printResponse({
                ok: true, type: 'video', provider: opts.provider, model: opts.model,
                outputFile, metadataFile, durationMs: mediaResult.durationMs, jobId: result.jobId,
              }, opts.json);
              return;
            }
          }

          // Return job info without waiting
          const response: SuccessResponse = {
            ok: true, type: 'video', provider: opts.provider, model: opts.model,
            jobId: result.jobId, status: result.status, statusUrl: result.statusUrl,
          };
          printResponse(response, opts.json);
        } else {
          // Synchronous result
          let metadataFile: string | undefined;
          if (opts.metadata) {
            metadataFile = writeMetadata(outputFile, {
              provider: opts.provider, model: opts.model, type: 'video',
              prompt: opts.prompt, outputFile: result.outputFile,
              createdAt: new Date().toISOString(), durationMs: result.durationMs,
            });
          }
          printResponse({
            ok: true, type: 'video', provider: opts.provider, model: opts.model,
            outputFile: result.outputFile, metadataFile, durationMs: result.durationMs,
          }, opts.json);
        }

      } catch (err) {
        log.error(err, 'Video generate error');
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  video
    .command('image-to-video')
    .description('Generate a video from an image')
    .requiredOption('--provider <provider>', 'Provider to use')
    .requiredOption('--image <path>', 'Source image file')
    .requiredOption('--model <model>', 'Model to use')
    .option('--prompt <prompt>', 'Optional guiding prompt')
    .option('--duration <seconds>', 'Video duration')
    .option('--aspect-ratio <ratio>', 'Aspect ratio')
    .option('--output <path>', 'Output file path')
    .option('--output-dir <dir>', 'Output directory')
    .option('--overwrite', 'Overwrite existing files', false)
    .option('--json', 'Output as JSON', false)
    .option('--dry-run', 'Validate without calling provider', false)
    .option('--wait', 'Wait for completion', false)
    .option('--poll-interval <ms>', 'Polling interval', '5000')
    .option('--timeout <ms>', 'Max wait time', '600000')
    .option('--allow-external-output', 'Allow external output', false)
    .action(async (opts) => {
      try {
        validateFileExists(opts.image, 'Source image');

        const outputFile = resolveOutputPath(
          opts.output ? opts.output.split(/[/\\]/).pop()! : `i2v-${Date.now()}.mp4`,
          { output: opts.output, outputDir: opts.outputDir, allowExternalOutput: opts.allowExternalOutput },
        );

        if (opts.dryRun) {
          printResponse({ ok: true, type: 'image-to-video', provider: opts.provider, model: opts.model, outputFile, dryRun: true }, opts.json);
          return;
        }

        const provider = getProvider(opts.provider);
        if (!provider.imageToVideo) {
          throw new MediaGenError('CAPABILITY_NOT_SUPPORTED', `Provider "${opts.provider}" does not support image-to-video`, {
            provider: opts.provider, suggestion: 'Try: luma, runway',
          });
        }

        const result = await provider.imageToVideo({
          image: opts.image,
          prompt: opts.prompt,
          model: opts.model,
          duration: opts.duration ? parseFloat(opts.duration) : undefined,
          aspectRatio: opts.aspectRatio,
          outputFile,
        });

        if (isAsyncResult(result)) {
          if (opts.wait && provider.getJobStatus && provider.downloadJob) {
            await pollForCompletion(result.jobId, opts.provider, (id) => provider.getJobStatus!(id), {
              wait: true, pollInterval: parseInt(opts.pollInterval), timeout: parseInt(opts.timeout),
            });
            const media = await provider.downloadJob!(result.jobId, outputFile);
            printResponse({ ok: true, type: 'image-to-video', provider: opts.provider, model: opts.model, outputFile: media.outputFile, durationMs: media.durationMs, jobId: result.jobId }, opts.json);
          } else {
            printResponse({ ok: true, type: 'image-to-video', provider: opts.provider, jobId: result.jobId, status: result.status }, opts.json);
          }
        } else {
          printResponse({ ok: true, type: 'image-to-video', provider: opts.provider, model: opts.model, outputFile: result.outputFile, durationMs: result.durationMs }, opts.json);
        }
      } catch (err) {
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  video
    .command('extend')
    .description('Extend an existing video')
    .requiredOption('--provider <provider>', 'Provider to use')
    .requiredOption('--video <path>', 'Source video file')
    .requiredOption('--model <model>', 'Model to use')
    .option('--prompt <prompt>', 'Extension prompt')
    .option('--duration <seconds>', 'Additional duration')
    .option('--output <path>', 'Output file path')
    .option('--json', 'Output as JSON', false)
    .option('--dry-run', 'Validate without calling provider', false)
    .option('--wait', 'Wait for completion', false)
    .option('--poll-interval <ms>', 'Polling interval', '5000')
    .option('--timeout <ms>', 'Max wait time', '600000')
    .action(async (opts) => {
      try {
        validateFileExists(opts.video, 'Source video');

        if (opts.dryRun) {
          printResponse({ ok: true, type: 'video-extend', provider: opts.provider, dryRun: true }, opts.json);
          return;
        }

        const provider = getProvider(opts.provider);
        if (!provider.extendVideo) {
          throw new MediaGenError('CAPABILITY_NOT_SUPPORTED', `Provider "${opts.provider}" does not support video extension`, {
            provider: opts.provider,
          });
        }

        const result = await provider.extendVideo({
          video: opts.video,
          prompt: opts.prompt,
          model: opts.model,
          duration: opts.duration ? parseFloat(opts.duration) : undefined,
          outputFile: opts.output || `extended-${Date.now()}.mp4`,
        });

        if (isAsyncResult(result)) {
          printResponse({ ok: true, type: 'video-extend', provider: opts.provider, jobId: result.jobId, status: result.status }, opts.json);
        } else {
          printResponse({ ok: true, type: 'video-extend', provider: opts.provider, outputFile: result.outputFile, durationMs: result.durationMs }, opts.json);
        }
      } catch (err) {
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  return video;
}
