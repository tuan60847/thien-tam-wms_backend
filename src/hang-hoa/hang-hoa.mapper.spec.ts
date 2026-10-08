import { Prisma } from '@prisma/client';
import {
  toHangHoaListItem,
  toHangHoaResponse,
  type HangHoaFull,
} from './hang-hoa.mapper.js';

const NOW = new Date('2026-10-01T00:00:00Z');
const row = {
  id: 'h1',
  maSP: 'SP00001',
  tenSP: 'Paracetamol 500mg',
  quyCach: 'Hộp 10 vỉ',
  maQuyCach: null,
  thueSuatGtgt: new Prisma.Decimal('8'),
  donViTinhGia: 'hộp',
  giaNhap: new Prisma.Decimal('90000'),
  giaHienThi: new Prisma.Decimal('125000.5'),
  giaToiThieu: new Prisma.Decimal('100000'),
  isKeDon: false,
  isCanGiuLanh: false,
  loaiKiemSoat: 'thuong',
  soDangKy: 'VD-1',
  ghiChu: null,
  trangThai: true,
  loaiHangId: 'l1',
  createdById: null,
  updatedById: null,
  createdAt: NOW,
  updatedAt: NOW,
  loaiHang: { id: 'l1', tenLoaiHang: 'Giảm đau' },
  tyLeQuyDois: [
    { id: 'u1', donViTinh: 'viên', soLuongQuyDoi: 1, hangHoaId: 'h1' },
    { id: 'u2', donViTinh: 'hộp', soLuongQuyDoi: 100, hangHoaId: 'h1' },
  ],
} as unknown as HangHoaFull;

describe('hang-hoa mapper', () => {
  it('tiền luôn là chuỗi 2 chữ số thập phân', () => {
    const dto = toHangHoaListItem(row, 'ADMIN');
    expect(dto.giaNhap).toBe('90000.00');
    expect(dto.giaHienThi).toBe('125000.50');
    expect(dto.giaToiThieu).toBe('100000.00');
  });

  it('NHAN_VIEN_KHO và người không có role: bỏ hẳn giaNhap/giaToiThieu (không để null)', () => {
    for (const role of ['NHAN_VIEN_KHO', null, undefined]) {
      const dto = toHangHoaListItem(row, role);
      expect(dto).not.toHaveProperty('giaNhap');
      expect(dto).not.toHaveProperty('giaToiThieu');
      expect(dto.giaHienThi).toBe('125000.50');
    }
  });

  it('QUAN_LY_KHO và KE_TOAN thấy đủ giá', () => {
    for (const role of ['QUAN_LY_KHO', 'KE_TOAN']) {
      expect(toHangHoaListItem(row, role)).toHaveProperty(
        'giaNhap',
        '90000.00',
      );
    }
  });

  it('donViCoBan là đơn vị có hệ số 1', () => {
    expect(toHangHoaListItem(row, 'ADMIN').donViCoBan).toBe('viên');
  });

  it('chi tiết kèm đơn vị quy đổi và không lộ các id nội bộ', () => {
    const dto = toHangHoaResponse(row, 'NHAN_VIEN_KHO');
    expect(dto.tyLeQuyDoi).toEqual([
      { id: 'u1', donViTinh: 'viên', soLuongQuyDoi: 1 },
      { id: 'u2', donViTinh: 'hộp', soLuongQuyDoi: 100 },
    ]);
    expect(dto).not.toHaveProperty('loaiHangId');
    expect(dto).not.toHaveProperty('createdById');
    expect(dto).not.toHaveProperty('giaNhap');
  });
});
