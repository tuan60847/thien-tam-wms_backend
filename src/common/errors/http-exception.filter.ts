import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { AppException } from './app.exception.js';
import { ERROR, type ErrorCode } from './error-codes.js';

export interface ErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details: unknown;
  path: string;
  timestamp: string;
  requestId: string | null;
}

interface Normalized {
  status: number;
  code: ErrorCode;
  message: string;
  details: unknown;
}

function fromPrisma(
  error: Prisma.PrismaClientKnownRequestError,
): Normalized | null {
  switch (error.code) {
    case 'P2002':
    case 'P2003':
      return normalize('COMMON_CONFLICT');
    case 'P2025':
      return normalize('COMMON_NOT_FOUND');
    case 'P2034':
      return normalize('COMMON_CONCURRENT_UPDATE');
    default:
      return null;
  }
}

function normalize(
  code: ErrorCode,
  extra: { status?: number; details?: unknown } = {},
): Normalized {
  const definition = ERROR[code];
  const message =
    typeof definition.message === 'function'
      ? definition.message({})
      : definition.message;
  return {
    status: extra.status ?? definition.status,
    code,
    message,
    details: extra.details ?? null,
  };
}

function fromHttpException(exception: HttpException): Normalized {
  const status = exception.getStatus();
  const response = exception.getResponse();
  const text =
    typeof response === 'string'
      ? response
      : ((response as { message?: unknown }).message ?? '');
  const joined = Array.isArray(text)
    ? text.join(' ')
    : typeof text === 'string'
      ? text
      : '';

  switch (status) {
    case 400:
      return /uuid/i.test(joined)
        ? normalize('COMMON_INVALID_ID')
        : normalize('VALIDATION_FAILED');
    case 401:
      return normalize('AUTH_UNAUTHORIZED');
    case 403:
      return normalize('AUTH_FORBIDDEN');
    case 404:
      return normalize('COMMON_NOT_FOUND');
    case 409:
      return normalize('COMMON_CONFLICT');
    case 413:
      return normalize('COMMON_PAYLOAD_TOO_LARGE');
    case 429:
      return normalize('COMMON_TOO_MANY_REQUESTS');
    case 503:
      return normalize('COMMON_SERVICE_UNAVAILABLE', {
        details: typeof response === 'object' ? response : null,
      });
    default:
      return normalize('COMMON_ERROR', { status });
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(HttpExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: string | number }>();
    const response = http.getResponse<Response>();

    const normalized = this.normalize(exception);
    if (normalized.status >= 500) {
      this.logger.error(
        { err: exception, path: request.originalUrl },
        'Unhandled exception',
      );
    }

    const body: ErrorBody = {
      statusCode: normalized.status,
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
      path: request.originalUrl?.split('?')[0] ?? request.url,
      timestamp: new Date().toISOString(),
      requestId: request.id !== undefined ? String(request.id) : null,
    };
    response.status(normalized.status).json(body);
  }

  private normalize(exception: unknown): Normalized {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }
    if (exception instanceof HttpException) {
      return fromHttpException(exception);
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return fromPrisma(exception) ?? normalize('INTERNAL_ERROR');
    }
    return normalize('INTERNAL_ERROR');
  }
}
