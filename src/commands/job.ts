/**
 * Async job management commands.
 */

import { Command } from 'commander';
import { getProvider } from '../providers/registry.js';
import { resolveOutputPath, ensureOutputDir, printResponse } from '../core/output.js';
import { MediaGenError, toErrorResponse } from '../core/errors.js';

export function createJobCommand(): Command {
  const job = new Command('job').description('Manage async generation jobs');

  job
    .command('status')
    .description('Check the status of an async job')
    .requiredOption('--provider <provider>', 'Provider ID')
    .requiredOption('--job-id <id>', 'Job ID')
    .option('--json', 'Output as JSON', false)
    .action(async (opts) => {
      try {
        const provider = getProvider(opts.provider);
        if (!provider.getJobStatus) {
          throw new MediaGenError('CAPABILITY_NOT_SUPPORTED',
            `Provider "${opts.provider}" does not support job status checks`,
            { provider: opts.provider });
        }

        const status = await provider.getJobStatus(opts.jobId);

        if (opts.json) {
          console.log(JSON.stringify({ ok: true, ...status }, null, 2));
        } else {
          console.log(`Job: ${status.jobId}`);
          console.log(`Provider: ${status.provider}`);
          console.log(`Status: ${status.status}`);
          if (status.progress !== undefined) console.log(`Progress: ${status.progress}%`);
          if (status.error) console.log(`Error: ${status.error}`);
        }
      } catch (err) {
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  job
    .command('download')
    .description('Download the result of a completed job')
    .requiredOption('--provider <provider>', 'Provider ID')
    .requiredOption('--job-id <id>', 'Job ID')
    .option('--output <path>', 'Output file path')
    .option('--output-dir <dir>', 'Output directory')
    .option('--overwrite', 'Overwrite existing', false)
    .option('--json', 'Output as JSON', false)
    .action(async (opts) => {
      try {
        const provider = getProvider(opts.provider);
        if (!provider.downloadJob) {
          throw new MediaGenError('CAPABILITY_NOT_SUPPORTED',
            `Provider "${opts.provider}" does not support job downloads`,
            { provider: opts.provider });
        }

        const outputFile = resolveOutputPath(
          opts.output ? opts.output.split(/[/\\]/).pop()! : `job-${opts.jobId}.mp4`,
          { output: opts.output, outputDir: opts.outputDir },
        );

        ensureOutputDir(outputFile);
        const result = await provider.downloadJob(opts.jobId, outputFile);

        printResponse({
          ok: true,
          type: 'job-download',
          provider: opts.provider,
          jobId: opts.jobId,
          outputFile: result.outputFile,
          durationMs: result.durationMs,
        }, opts.json);
      } catch (err) {
        printResponse(toErrorResponse(err), opts.json);
        process.exitCode = 1;
      }
    });

  return job;
}
