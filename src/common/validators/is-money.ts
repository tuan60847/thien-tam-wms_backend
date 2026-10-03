import { registerDecorator, type ValidationOptions } from 'class-validator';

// Money travels as a string: up to 13 integer digits and 2 decimals (Decimal(15,2)).
const MONEY = /^\d{1,13}(\.\d{1,2})?$/;

export function isMoney(value: unknown): value is string {
  return typeof value === 'string' && MONEY.test(value);
}

export function isPositiveMoney(value: unknown): value is string {
  return isMoney(value) && Number(value) > 0;
}

function decorator(
  name: string,
  validate: (value: unknown) => boolean,
  message: string,
) {
  return (options?: ValidationOptions): PropertyDecorator =>
    (target, propertyKey) => {
      registerDecorator({
        name,
        target: target.constructor,
        propertyName: propertyKey as string,
        options: { message, ...options },
        validator: { validate },
      });
    };
}

export const IsMoney = decorator(
  'isMoney',
  isMoney,
  'Số tiền phải là chuỗi dạng "125000.00" (tối đa 2 chữ số thập phân)',
);

export const IsPositiveMoney = decorator(
  'isPositiveMoney',
  isPositiveMoney,
  'Số tiền phải lớn hơn 0, dạng chuỗi "125000.00"',
);
