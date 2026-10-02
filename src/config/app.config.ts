import { registerAs } from '@nestjs/config';

export type LogLevel =
  'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  corsOrigins: string[];
  trustProxy: number | false;
  logLevel: LogLevel;
  // Max POST /auth/login attempts per minute per IP.
  loginRateLimit: number;
  swaggerEnabled: boolean;
  swaggerUser: string | null;
  swaggerPassword: string | null;
}

const LOG_LEVELS: readonly LogLevel[] = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
];

function parseNodeEnv(value: string | undefined): AppConfig['nodeEnv'] {
  if (value === undefined || value === '') {
    return 'development';
  }
  if (value === 'development' || value === 'test' || value === 'production') {
    return value;
  }
  throw new Error(`NODE_ENV không hợp lệ: ${value}`);
}

export function parseBoolean(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error(`Giá trị boolean không hợp lệ: ${value}`);
}

export function loadAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const nodeEnv = parseNodeEnv(env.NODE_ENV);
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT không hợp lệ: ${env.PORT}`);
  }

  const logLevel = (env.LOG_LEVEL ||
    (nodeEnv === 'development' ? 'debug' : 'info')) as LogLevel;
  if (!LOG_LEVELS.includes(logLevel)) {
    throw new Error(`LOG_LEVEL không hợp lệ: ${env.LOG_LEVEL}`);
  }

  const loginRateLimit = Number(env.LOGIN_RATE_LIMIT ?? 5);
  if (!Number.isInteger(loginRateLimit) || loginRateLimit < 1) {
    throw new Error(`LOGIN_RATE_LIMIT không hợp lệ: ${env.LOGIN_RATE_LIMIT}`);
  }

  const trustProxy = env.TRUST_PROXY ? Number(env.TRUST_PROXY) : false;
  if (
    trustProxy !== false &&
    (!Number.isInteger(trustProxy) || trustProxy < 0)
  ) {
    throw new Error(`TRUST_PROXY không hợp lệ: ${env.TRUST_PROXY}`);
  }

  const swaggerEnabled = parseBoolean(
    env.SWAGGER_ENABLED,
    nodeEnv !== 'production',
  );
  const swaggerUser = env.SWAGGER_USER || null;
  const swaggerPassword = env.SWAGGER_PASSWORD || null;
  if (
    swaggerEnabled &&
    nodeEnv === 'production' &&
    (!swaggerUser || !swaggerPassword)
  ) {
    throw new Error(
      'Bật Swagger ở production cần SWAGGER_USER và SWAGGER_PASSWORD',
    );
  }

  return {
    nodeEnv,
    port,
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    trustProxy,
    logLevel,
    loginRateLimit,
    swaggerEnabled,
    swaggerUser,
    swaggerPassword,
  };
}

export const appConfig = registerAs('app', (): AppConfig =>
  loadAppConfig(process.env),
);
