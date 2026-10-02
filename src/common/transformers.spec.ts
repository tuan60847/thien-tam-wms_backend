import { plainToInstance } from 'class-transformer';
import {
  EmptyToUndefined,
  LowerTrim,
  ToBoolean,
  Trim,
} from './transformers.js';

class Sample {
  @Trim() ten?: unknown;
  @LowerTrim() email?: unknown;
  @ToBoolean() active?: unknown;
  @EmptyToUndefined() note?: unknown;
}

const run = (plain: Record<string, unknown>) => plainToInstance(Sample, plain);

describe('transformers', () => {
  it('Trim cắt khoảng trắng hai đầu, giữ nguyên kiểu khác chuỗi', () => {
    expect(run({ ten: '  An  ' }).ten).toBe('An');
    expect(run({ ten: 5 }).ten).toBe(5);
    expect(run({ ten: null }).ten).toBeNull();
  });

  it('LowerTrim cắt và đổi sang chữ thường', () => {
    expect(run({ email: '  A@B.Com ' }).email).toBe('a@b.com');
  });

  it('ToBoolean đổi "true"/"false" của query string, giữ nguyên giá trị khác', () => {
    expect(run({ active: 'true' }).active).toBe(true);
    expect(run({ active: 'false' }).active).toBe(false);
    expect(run({ active: 'yes' }).active).toBe('yes');
  });

  it('EmptyToUndefined coi chuỗi rỗng là không gửi', () => {
    expect(run({ note: '' }).note).toBeUndefined();
    expect(run({ note: 'x' }).note).toBe('x');
  });
});
