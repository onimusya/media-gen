/**
 * Structured error types for media-gen-cli.
 */

export type ErrorCode =
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_NOT_FOUND'
  | 'CAPABILITY_NOT_SUPPORTED'
  | 'INVALID_INPUT'
  | 'FILE_NOT_FOUND'
  | 'FILE_ALREADY_EXISTS'
  | 'OUTPUT_PATH_INVALID'
  | 'EXTERNAL_OUTPUT_BLOCKED'
  | 'API_ERROR'
  | 'RATE_LIMITED'
  | 'CONTENT_POLICY_VIOLATION'
  | 'JOB_FAILED'
  | 'JOB_TIMEOUT'
  | 'NETWORK_ERROR'
  | 'CONFIG_INVALID'
  | 'UNKNOWN_ERROR';

export interface ErrorResponse {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    provider?: string;
    suggestion?: string;
    details?: unknown;
  };
}

export interface SuccessResponse {
  ok: true;
  type: string;
  provider: string;
  model?: string;
  outputFile?: string;
  metadataFile?: string;
  durationMs?: number;
  jobId?: string;
  status?: string;
  [key: string]: unknown;
}

export type CLIResponse = ErrorResponse | SuccessResponse;

export class MediaGenError extends Error {
  public readonly code: ErrorCode;
  public readonly provider?: string;
  public readonly suggestion?: string;
  public readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { provider?: string; suggestion?: string; details?: unknown },
  ) {
    super(message);
    this.name = 'MediaGenError';
    this.code = code;
    this.provider = options?.provider;
    this.suggestion = options?.suggestion;
    this.details = options?.details;
  }

  toJSON(): ErrorResponse {
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.provider && { provider: this.provider }),
        ...(this.suggestion && { suggestion: this.suggestion }),
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof MediaGenError) {
    return err.toJSON();
  }

  const message = err instanceof Error ? err.message : String(err);
  return {
    ok: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message,
    },
  };
}
