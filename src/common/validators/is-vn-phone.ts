import { Transform } from 'class-transformer';
import { registerDecorator, type ValidationOptions } from 'class-validator';

// Spaces, dots, hyphens and parentheses are formatting only.
export function normalizePhone(value: string): string {
  return value.replace(/[\s.()-]/g, '');
}

// 10-11 digits starting with 0, or +84 followed by 9 digits.
export function isVnPhone(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(0\d{9,10}|\+84\d{9})$/.test(normalizePhone(value))
  );
}

// Stores the cleaned-up number (digits and optional leading +).
export const NormalizePhone = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePhone(value) : value,
  );

export function IsVnPhone(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isVnPhone',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: { message: 'Số điện thoại không hợp lệ', ...options },
      validator: { validate: isVnPhone },
    });
  };
}
