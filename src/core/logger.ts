/**
 * Structured logger for media-gen-cli.
 * Uses pino in debug mode, silent otherwise for clean CLI output.
 */

import pino from 'pino';

let logger: pino.Logger;
let debugMode = false;

export function initLogger(debug: boolean): void {
  debugMode = debug;
  logger = pino({
    level: debug ? 'debug' : 'silent',
    transport: debug
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });
}

export function getLogger(): pino.Logger {
  if (!logger) {
    initLogger(false);
  }
  return logger;
}

export function isDebug(): boolean {
  return debugMode;
}
