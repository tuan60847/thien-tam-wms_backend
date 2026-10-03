import { toBaseQuantity } from './unit-conversion.js';

describe('toBaseQuantity', () => {
  it.each([
    [3, 100, 300],
    [1, 1, 1],
    [5, 10, 50],
    [21474, 100000, 2_147_400_000],
  ])('%i × %i = %i', (qty, ratio, expected) => {
    expect(toBaseQuantity(qty, ratio)).toBe(expected);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'số lượng không hợp lệ %s → VALIDATION_FAILED',
    (qty) => {
      expect(() => toBaseQuantity(qty, 10)).toThrow(
        expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      );
    },
  );

  it('vượt giới hạn Int của MySQL → VALIDATION_FAILED', () => {
    expect(() => toBaseQuantity(2_147_483_647, 2)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    );
    expect(toBaseQuantity(2_147_483_647, 1)).toBe(2_147_483_647);
  });
});
