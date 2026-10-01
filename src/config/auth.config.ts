import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
}

const MIN_SECRET_LENGTH = 32;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}`);
  }
  return value;
}

function requireSecret(name: string): string {
  const value = requireEnv(name);
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} phải có ít nhất ${MIN_SECRET_LENGTH} ký tự`);
  }
  return value;
}

export const authConfig = registerAs('auth', (): AuthConfig => {
  const accessSecret = requireSecret('JWT_ACCESS_SECRET');
  const refreshSecret = requireSecret('JWT_REFRESH_SECRET');
  if (accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET và JWT_REFRESH_SECRET phải khác nhau');
  }
  return {
    accessSecret,
    refreshSecret,
    accessTtl: requireEnv('JWT_ACCESS_TTL'),
    refreshTtl: requireEnv('JWT_REFRESH_TTL'),
  };
});
