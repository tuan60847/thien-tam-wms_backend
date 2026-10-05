import { registerDecorator, type ValidationOptions } from 'class-validator';

// Vietnamese tax code: 10 digits, optionally followed by -NNN for a branch.
export function isVnTaxCode(value: unknown): value is string {
  return typeof value === 'string' && /^\d{10}(-\d{3})?$/.test(value);
}

export function IsVnTaxCode(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isVnTaxCode',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: {
        message: 'Mã số thuế gồm 10 chữ số (có thể kèm -NNN cho chi nhánh)',
        ...options,
      },
      validator: { validate: isVnTaxCode },
    });
  };
}
