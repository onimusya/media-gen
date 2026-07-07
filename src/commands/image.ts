/**
 * Image generation and editing commands.
 */

import { Command } from 'commander';
import { getProvider } from '../providers/registry.js';
import { resolveOutputPath, checkOverwrite, ensureOutputDir, writeMetadata, printResponse } from '../core/output.js';
import { MediaGenError, toErrorResponse } from '../core/errors.js';
import type { SuccessResponse } from '../core/errors.js';
import { getLogger } from '../core/logger.js';
import { validateFileExists } from '../core/validation.js';
import { resolveProvider, resolveModel } from '../core/config.js';

export function createImageCommand(): Command {
  const image = new Command('image').description('Image generation and editing');

  image
    .command('generate')
    .description('Generate an image from a text prompt')
    .requiredOption('--prompt <prompt>', 'Image generation prompt')
    .option('--provider <provider>', 'Provider to use (e.g., openai, stability, fal, openrouter)')
    .option('--model <model>', 'Model to use')
    .option('--size <size>', 'Image size (e.g., 1024x1024)', '1024x1024')
    .option('--quality <quality>', 'Image quality')
    .option('--style <style>', 'Image style')
    .option('-n, --count <n>', 'Number of images', '1')
    .option('--negative-prompt <prompt>', 'Negative prompt')
    .option('--output <path>', 'Output file path')
    .option('--output-dir <dir>', 'Output directory')
    .option('--overwrite', 'Overwrite existing files', false)
    .option('--metadata', 'Save metadata JSON file', false)
    .option('--json', 'Output result as JSON', false)
    .option('--dry-run', 'Validate inputs without calling the provider', false)
    .option('--allow-external-output', 'Allow output outside project dir', false)
    .option('--debug', 'Enable debug logging', false)
    .action(async (opts) => {
      const log = getLogger();
      try {
        const provider = resolveProvider(opts.provider, 'image');
        const model = resolveModel(opts.model, 'image');

        if (!provider) {
          throw new MediaGenError('INVALID_INPUT', 'No provider specified. Use --provider or set MEDIA_GEN_DEFAULT_PROVIDER / MEDIA_GEN_IMAGE_PROVIDER in .env');
        }

        const outputFile = resolveOutputPath(
          opts.output ? opts.output.split(/[/\\]/).pop()! : `image-${Date.now()}.png`,
          { output: opts.output, outputDir: opts.outputDir, allowExternalOutput: opts.allowExternalOutput },
        );

        if (opts.dryRun) {
          const response: SuccessResponse = {
            ok: true,
            type: 'image',
            provider,
            model: model || 'default',
            outputFile,
            dryRun: true,
          };
          printResponse(response, opts.json);
          return;
        }

        checkOverwrite(outputFile, opts.overwrite);
        ensureOutputDir(outputFile);

        const providerInstance = getProvider(provider);
        if (!providerInstance.generateImage) {
          throw new MediaGenError('CAPABILITY_NOT_SUPPORTED', `Provider "${provider}" does not support image generation`, {
            provider,
            suggestion: 'Try: openai, stability, fal, replicate, google, openrouter',
          });
        }

        const result = await providerInstance.generateImage({
          prompt: opts.prompt,
          model: model || 'gpt-image-1',
          size: opts.size,
          quality: opts.quality,
          style: opts.style,
          n: parseInt(opts.count),
          negativePrompt: opts.negativePrompt,
          outputFile,
        });

        let metadataFile: string | undefined;
        if (opts.metadata) {
          metadataFile = writeMetadata(outputFile, {
            provider,
            model: opts.model,
            type: 'image',
            prompt: opts.prompt,
            input: { size: opts.size, quality: opts.quality, style: opts.style },
            outputFile: result.outputFile,
            createdAt: new Date().toISOString(),
            durationMs: result.durationMs,
          });
        }

        const response: SuccessResponse = {
          ok: true,
          type: 'image',
          provider,
          model,
          outputFile: result.outputFile,
          metadataFile,
          durationMs: result.durationMs,
        };
        printResponse(response, opts.json);

      } catch (err) {
        log.error(err, 'Image generate error');
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  image
    .command('edit')
    .description('Edit an existing image with a prompt')
    .option('--provider <provider>', 'Provider to use')
    .requiredOption('--image <path>', 'Source image file')
    .requiredOption('--prompt <prompt>', 'Edit prompt')
    .option('--model <model>', 'Model to use')
    .option('--mask <path>', 'Mask image for inpainting')
    .option('--size <size>', 'Output size')
    .option('--output <path>', 'Output file path')
    .option('--output-dir <dir>', 'Output directory')
    .option('--overwrite', 'Overwrite existing files', false)
    .option('--metadata', 'Save metadata JSON', false)
    .option('--json', 'Output as JSON', false)
    .option('--dry-run', 'Validate without calling provider', false)
    .option('--allow-external-output', 'Allow output outside project dir', false)
    .option('--debug', 'Enable debug logging', false)
    .action(async (opts) => {
      try {
        validateFileExists(opts.image, 'Source image');
        if (opts.mask) validateFileExists(opts.mask, 'Mask image');

        const providerName = resolveProvider(opts.provider, 'image');
        const model = resolveModel(opts.model, 'image');

        if (!providerName) {
          throw new MediaGenError('INVALID_INPUT', 'No provider specified. Use --provider or set MEDIA_GEN_DEFAULT_PROVIDER / MEDIA_GEN_IMAGE_PROVIDER in .env');
        }

        const outputFile = resolveOutputPath(
          opts.output ? opts.output.split(/[/\\]/).pop()! : `edited-${Date.now()}.png`,
          { output: opts.output, outputDir: opts.outputDir, allowExternalOutput: opts.allowExternalOutput },
        );

        if (opts.dryRun) {
          printResponse({ ok: true, type: 'image-edit', provider: providerName, outputFile, dryRun: true }, opts.json);
          return;
        }

        checkOverwrite(outputFile, opts.overwrite);
        ensureOutputDir(outputFile);

        const providerInstance = getProvider(providerName);
        if (!providerInstance.editImage) {
          throw new MediaGenError('CAPABILITY_NOT_SUPPORTED', `Provider "${providerName}" does not support image editing`, {
            provider: providerName,
            suggestion: 'Try: openai',
          });
        }

        const result = await providerInstance.editImage({
          image: opts.image,
          prompt: opts.prompt,
          model: model || 'gpt-image-1',
          mask: opts.mask,
          size: opts.size,
          outputFile,
        });

        let metadataFile: string | undefined;
        if (opts.metadata) {
          metadataFile = writeMetadata(outputFile, {
            provider: providerName,
            model,
            type: 'image-edit',
            prompt: opts.prompt,
            input: { image: opts.image, mask: opts.mask },
            outputFile: result.outputFile,
            createdAt: new Date().toISOString(),
            durationMs: result.durationMs,
          });
        }

        printResponse({
          ok: true,
          type: 'image-edit',
          provider: providerName,
          model,
          outputFile: result.outputFile,
          metadataFile,
          durationMs: result.durationMs,
        }, opts.json);

      } catch (err) {
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  return image;
}
