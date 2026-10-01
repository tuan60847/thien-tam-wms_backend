import { HttpException } from '@nestjs/common';
import { ERROR, type ErrorCode } from './error-codes.js';

export interface AppExceptionOptions {
  // Extra structured information for the client (e.g. { conLai: 3 }).
  details?: unknown;
  // Values interpolated into message functions.
  params?: Record<string, unknown>;
  // Override the default message, rarely needed.
  message?: string;
  // Override the default status (only for COMMON_ERROR wrapping a foreign status).
  status?: number;
}

export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(code: ErrorCode, options: AppExceptionOptions = {}) {
    const definition = ERROR[code];
    const message =
      options.message ??
      (typeof definition.message === 'function'
        ? definition.message(options.params ?? {})
        : definition.message);
    super(message, options.status ?? definition.status);
    this.code = code;
    this.details = options.details ?? null;
  }
}
