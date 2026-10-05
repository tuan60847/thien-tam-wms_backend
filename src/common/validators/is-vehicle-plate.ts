import { Transform } from 'class-transformer';
import { registerDecorator, type ValidationOptions } from 'class-validator';

// Spaces, dots and hyphens are formatting only; stored upper-case: "51c-123.45" -> "51C12345".
export function normalizePlate(value: string): string {
  return value.replace(/[\s.-]/g, '').toUpperCase();
}

export function isVehiclePlate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{2}[A-Z]{1,2}\d{4,6}$/.test(normalizePlate(value))
  );
}

export const NormalizePlate = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePlate(value) : value,
  );

export function IsVehiclePlate(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isVehiclePlate',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: { message: 'Biển số xe không hợp lệ', ...options },
      validator: { validate: isVehiclePlate },
    });
  };
}
