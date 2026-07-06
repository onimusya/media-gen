/**
 * Async job polling and management for media-gen-cli.
 */

import { getLogger } from './logger.js';
import { MediaGenError } from './errors.js';
import type { AsyncMediaResult, JobStatusResult, MediaResult } from './provider.js';

export interface PollOptions {
  wait: boolean;
  pollInterval: number;
  timeout: number;
}

export const DEFAULT_POLL_OPTIONS: PollOptions = {
  wait: false,
  pollInterval: 5000,
  timeout: 600000,
};

export type StatusChecker = (jobId: string) => Promise<JobStatusResult>;
export type ResultDownloader = (jobId: string, outputFile: string) => Promise<MediaResult>;

export async function pollForCompletion(
  jobId: string,
  provider: string,
  checkStatus: StatusChecker,
  options: PollOptions,
  onProgress?: (status: JobStatusResult) => void,
): Promise<JobStatusResult> {
  const log = getLogger();
  const startTime = Date.now();

  log.debug({ jobId, provider, options }, 'Starting job poll');

  while (true) {
    const elapsed = Date.now() - startTime;
    if (elapsed > options.timeout) {
      throw new MediaGenError('JOB_TIMEOUT', `Job ${jobId} timed out after ${options.timeout}ms`, {
        provider,
        suggestion: 'Increase --timeout or check job status manually with: media-gen job status',
      });
    }

    const status = await checkStatus(jobId);
    log.debug({ jobId, status: status.status, progress: status.progress }, 'Job status update');

    if (onProgress) {
      onProgress(status);
    }

    if (status.status === 'completed') {
      return status;
    }

    if (status.status === 'failed') {
      throw new MediaGenError('JOB_FAILED', `Job ${jobId} failed: ${status.error || 'Unknown error'}`, {
        provider,
      });
    }

    await sleep(options.pollInterval);
  }
}

export function isAsyncResult(result: AsyncMediaResult | MediaResult): result is AsyncMediaResult {
  return 'jobId' in result && 'status' in result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
