import { IsInt, IsString, ValidateNested, validate } from 'class-validator';
import { plainToInstance, Type } from 'class-transformer';
import {
  flattenValidationErrors,
  validationExceptionFactory,
} from './validation.js';

class Child {
  @IsInt()
  soLuong!: number;
}

class Parent {
  @IsString()
  ten!: string;

  @ValidateNested({ each: true })
  @Type(() => Child)
  chiTiet!: Child[];
}

describe('flattenValidationErrors', () => {
  it('gom lỗi theo field, kể cả field lồng nhau', async () => {
    const errors = await validate(
      plainToInstance(Parent, { ten: 1, chiTiet: [{ soLuong: 'x' }] }),
    );
    const details = flattenValidationErrors(errors);

    expect(details).toContainEqual({
      field: 'ten',
      messages: ['ten must be a string'],
    });
    expect(details).toContainEqual({
      field: 'chiTiet.0.soLuong',
      messages: ['soLuong must be an integer number'],
    });
  });

  it('trả mảng rỗng khi không có lỗi', () => {
    expect(flattenValidationErrors([])).toEqual([]);
  });
});

describe('validationExceptionFactory', () => {
  it('tạo AppException VALIDATION_FAILED kèm details', async () => {
    const errors = await validate(plainToInstance(Parent, {}));
    const exception = validationExceptionFactory(errors);
    expect(exception.code).toBe('VALIDATION_FAILED');
    expect(exception.getStatus()).toBe(400);
    expect(Array.isArray(exception.details)).toBe(true);
  });
});
