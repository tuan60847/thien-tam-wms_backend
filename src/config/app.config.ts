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
  // Days before expiry from which a lot counts as "can_date" (near expiry).
  expiryWarningDays: number;
  // Minimum remaining shelf life (days) to receive / issue a lot; 0 = rule off.
  minShelfLifeDaysReceive: number;
  minShelfLifeDaysIssue: number;
  jobsEnabled: boolean;
  jobsTimezone: string;
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

function parseIntInRange(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `${name} phải là số nguyên trong khoảng ${min}-${max}: ${raw}`,
    );
  }
  return value;
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

  const expiryWarningDays = parseIntInRange(
    env,
    'EXPIRY_WARNING_DAYS',
    90,
    1,
    365,
  );
  const minShelfLifeDaysReceive = parseIntInRange(
    env,
    'MIN_SHELF_LIFE_DAYS_RECEIVE',
    0,
    0,
    3650,
  );
  const minShelfLifeDaysIssue = parseIntInRange(
    env,
    'MIN_SHELF_LIFE_DAYS_ISSUE',
    0,
    0,
    3650,
  );
  const jobsTimezone = env.JOBS_TIMEZONE || 'Asia/Ho_Chi_Minh';
  try {
    new Intl.DateTimeFormat('en', { timeZone: jobsTimezone });
  } catch {
    throw new Error(`JOBS_TIMEZONE không hợp lệ: ${jobsTimezone}`);
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
    expiryWarningDays,
    minShelfLifeDaysReceive,
    minShelfLifeDaysIssue,
    jobsEnabled: parseBoolean(env.JOBS_ENABLED, true),
    jobsTimezone,
    swaggerEnabled,
    swaggerUser,
    swaggerPassword,
  };
}

export const appConfig = registerAs('app', (): AppConfig =>
  loadAppConfig(process.env),
);
