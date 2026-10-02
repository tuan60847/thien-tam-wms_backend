import { Transform } from 'class-transformer';

// Trim strings; leaves other types for the validators to reject.
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

// Trim and lower-case (usernames, emails: unique regardless of case).
export const LowerTrim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

// Query strings arrive as 'true'/'false'.
export const ToBoolean = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    return value;
  });

// '' -> undefined so an empty optional field is treated as "not sent".
export const EmptyToUndefined = () =>
  Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  );
