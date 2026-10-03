import { AppException } from '../common/errors/app.exception.js';

const INT_MAX = 2_147_483_647; // MySQL INT, the type of TonKho.soLuong

// Quantity in the base unit = quantity entered × ratio of the unit it was entered in.
export function toBaseQuantity(soLuong: number, heSoQuyDoi: number): number {
  if (!Number.isInteger(soLuong) || soLuong < 1) {
    throw new AppException('VALIDATION_FAILED', {
      details: [
        { field: 'soLuong', messages: ['Số lượng phải là số nguyên dương'] },
      ],
    });
  }
  const base = soLuong * heSoQuyDoi;
  if (!Number.isSafeInteger(base) || base > INT_MAX) {
    throw new AppException('VALIDATION_FAILED', {
      details: [
        {
          field: 'soLuong',
          messages: ['Số lượng quy đổi vượt giới hạn cho phép'],
        },
      ],
    });
  }
  return base;
}
