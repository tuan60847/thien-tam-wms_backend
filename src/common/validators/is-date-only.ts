import { registerDecorator, type ValidationOptions } from 'class-validator';

// YYYY-MM-DD that is a real calendar date.
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  );
}

export function IsDateOnly(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isDateOnly',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: {
        message: 'Ngày phải có định dạng YYYY-MM-DD hợp lệ',
        ...options,
      },
      validator: { validate: isDateOnly },
    });
  };
}
