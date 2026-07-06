/**
 * Generic polling utility for media-gen-cli.
 */

export interface PollConfig<T> {
  fn: () => Promise<T>;
  isDone: (result: T) => boolean;
  isFailed: (result: T) => boolean;
  interval: number;
  timeout: number;
  onPoll?: (result: T) => void;
}

export async function poll<T>(config: PollConfig<T>): Promise<T> {
  const startTime = Date.now();

  while (true) {
    const result = await config.fn();

    if (config.onPoll) {
      config.onPoll(result);
    }

    if (config.isDone(result)) {
      return result;
    }

    if (config.isFailed(result)) {
      throw new Error('Polling target entered failed state');
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= config.timeout) {
      throw new Error(`Polling timed out after ${config.timeout}ms`);
    }

    await new Promise((resolve) => setTimeout(resolve, config.interval));
  }
}
