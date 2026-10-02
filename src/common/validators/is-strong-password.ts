import { registerDecorator, type ValidationOptions } from 'class-validator';

const MAX_BYTES = 72; // bcrypt ignores everything after 72 bytes

// >= 8 characters with upper-case, lower-case and a digit; at most 72 bytes.
export function isStrongPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    Buffer.byteLength(value, 'utf8') <= MAX_BYTES &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value)
  );
}

export function IsStrongPassword(
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isStrongPassword',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: {
        message:
          'Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số (tối đa 72 byte)',
        ...options,
      },
      validator: { validate: isStrongPassword },
    });
  };
}
