import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ArgumentsHost } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { AppException } from './app.exception.js';
import {
  HttpExceptionFilter,
  type ErrorBody,
} from './http-exception.filter.js';

function run(exception: unknown, requestId: string | number = 'req-1') {
  const logError = vi.fn();
  const logger = {
    setContext: vi.fn(),
    error: logError,
  } as unknown as PinoLogger;
  const filter = new HttpExceptionFilter(logger);
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        id: requestId,
        originalUrl: '/api/v1/hang-hoa?q=abc',
        url: '/hang-hoa',
      }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  filter.catch(exception, host);

  return {
    status: status.mock.calls[0]?.[0] as number,
    body: json.mock.calls[0]?.[0] as ErrorBody,
    logError,
  };
}

describe('HttpExceptionFilter', () => {
  it('AppException → body chuẩn có code, details, path (không có query), requestId', () => {
    const { status, body } = run(
      new AppException('COMMON_CONFLICT', { details: { x: 1 } }),
    );
    expect(status).toBe(409);
    expect(body).toMatchObject({
      statusCode: 409,
      code: 'COMMON_CONFLICT',
      details: { x: 1 },
      path: '/api/v1/hang-hoa',
      requestId: 'req-1',
    });
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it.each([
    [new UnauthorizedException(), 401, 'AUTH_UNAUTHORIZED'],
    [new ForbiddenException(), 403, 'AUTH_FORBIDDEN'],
    [new NotFoundException(), 404, 'COMMON_NOT_FOUND'],
    [
      new BadRequestException('Validation failed (uuid is expected)'),
      400,
      'COMMON_INVALID_ID',
    ],
    [new BadRequestException('bad'), 400, 'VALIDATION_FAILED'],
    [new HttpException('x', 429), 429, 'COMMON_TOO_MANY_REQUESTS'],
    [new HttpException('x', 413), 413, 'COMMON_PAYLOAD_TOO_LARGE'],
    [new HttpException('x', 503), 503, 'COMMON_SERVICE_UNAVAILABLE'],
    [new HttpException('x', 418), 418, 'COMMON_ERROR'],
  ])(
    'HttpException của Nest %# → code chuẩn',
    (exception, expectedStatus, code) => {
      const { status, body } = run(exception);
      expect(status).toBe(expectedStatus);
      expect(body.code).toBe(code);
    },
  );

  it.each([
    ['P2002', 409, 'COMMON_CONFLICT'],
    ['P2003', 409, 'COMMON_CONFLICT'],
    ['P2025', 404, 'COMMON_NOT_FOUND'],
    ['P2034', 409, 'COMMON_CONCURRENT_UPDATE'],
  ])('lỗi Prisma %s → %i %s', (prismaCode, expectedStatus, code) => {
    const error = new Prisma.PrismaClientKnownRequestError('boom secret sql', {
      code: prismaCode,
      clientVersion: 'test',
    });
    const { status, body } = run(error);
    expect(status).toBe(expectedStatus);
    expect(body.code).toBe(code);
    expect(body.message).not.toContain('secret');
  });

  it('lỗi Prisma khác và lỗi lạ → 500 INTERNAL_ERROR, không lộ message, có log error', () => {
    const { status, body, logError } = run(new Error('db password is x'));
    expect(status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('db password');
    expect(logError).toHaveBeenCalledOnce();
  });

  it('requestId dạng số được chuyển thành chuỗi; thiếu → null', () => {
    expect(run(new AppException('COMMON_NOT_FOUND'), 42).body.requestId).toBe(
      '42',
    );
  });

  it('lỗi 4xx không ghi log error', () => {
    const { logError } = run(new AppException('AUTH_FORBIDDEN'));
    expect(logError).not.toHaveBeenCalled();
  });
});
