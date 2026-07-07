/**
 * Structured logger for media-gen-cli.
 * - Silent mode (default): errors only written to log file
 * - Debug mode (--debug): verbose to stderr AND log file
 * - Log files are stored at ~/.media-gen/logs/
 */

import pino from 'pino';
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

let logger: pino.Logger;
let debugMode = false;
let logFilePath: string;

function getLogDir(): string {
  return join(homedir(), '.media-gen', 'logs');
}

function ensureLogDir(): void {
  const dir = getLogDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getLogFile(): string {
  if (!logFilePath) {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    logFilePath = join(getLogDir(), `media-gen-${date}.log`);
  }
  return logFilePath;
}

export function initLogger(debug: boolean): void {
  debugMode = debug;
  ensureLogDir();

  if (debug) {
    // Debug mode: pretty-print to stderr
    logger = pino({
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          destination: 2, // stderr
        },
      },
    });

    // Also write to file
    const fileWriter = {
      write(msg: string): void {
        try {
          appendFileSync(getLogFile(), msg, 'utf-8');
        } catch { /* ignore */ }
      },
    };
    // Create a secondary file logger
    const fileLogger = pino({ level: 'debug' }, fileWriter);

    // Wrap logger methods to also write to file
    const origDebug = logger.debug.bind(logger);
    const origInfo = logger.info.bind(logger);
    const origWarn = logger.warn.bind(logger);
    const origError = logger.error.bind(logger);

    logger.debug = ((...args: Parameters<typeof origDebug>) => {
      origDebug(...args);
      (fileLogger.debug as Function)(...args);
    }) as typeof logger.debug;

    logger.info = ((...args: Parameters<typeof origInfo>) => {
      origInfo(...args);
      (fileLogger.info as Function)(...args);
    }) as typeof logger.info;

    logger.warn = ((...args: Parameters<typeof origWarn>) => {
      origWarn(...args);
      (fileLogger.warn as Function)(...args);
    }) as typeof logger.warn;

    logger.error = ((...args: Parameters<typeof origError>) => {
      origError(...args);
      (fileLogger.error as Function)(...args);
    }) as typeof logger.error;
  } else {
    // Silent mode: only log errors to file (no console output)
    const fileWriter = {
      write(msg: string): void {
        try {
          appendFileSync(getLogFile(), msg, 'utf-8');
        } catch { /* ignore */ }
      },
    };
    logger = pino({ level: 'error' }, fileWriter);
  }
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

export function getLogPath(): string {
  ensureLogDir();
  return getLogFile();
}
