import type { ValidationError } from 'class-validator';
import { AppException } from './app.exception.js';

export interface ValidationDetail {
  field: string;
  messages: string[];
}

// Flattens class-validator's nested errors into [{ field: 'a.b', messages }].
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): ValidationDetail[] {
  const details: ValidationDetail[] = [];
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    if (error.constraints) {
      details.push({ field, messages: Object.values(error.constraints) });
    }
    if (error.children?.length) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }
  return details;
}

export function validationExceptionFactory(
  errors: ValidationError[],
): AppException {
  return new AppException('VALIDATION_FAILED', {
    details: flattenValidationErrors(errors),
  });
}
