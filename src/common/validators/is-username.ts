import { registerDecorator, type ValidationOptions } from 'class-validator';

// Lower-case letters, digits, dot, underscore, hyphen; 3-32 characters.
export function isUsername(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9._-]{3,32}$/.test(value);
}

export function IsUsername(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isUsername',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: {
        message:
          'Tên đăng nhập gồm 3-32 ký tự: chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang',
        ...options,
      },
      validator: { validate: isUsername },
    });
  };
}
