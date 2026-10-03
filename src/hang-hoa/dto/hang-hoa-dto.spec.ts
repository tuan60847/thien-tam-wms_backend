import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLoaiHangDto } from '../../loai-hang/dto/create-loai-hang.dto.js';
import { UpdateLoaiHangDto } from '../../loai-hang/dto/update-loai-hang.dto.js';
import { CreateTyLeQuyDoiDto } from '../../ty-le-quy-doi/dto/create-ty-le-quy-doi.dto.js';
import { QueryTyLeQuyDoiDto } from '../../ty-le-quy-doi/dto/query-ty-le-quy-doi.dto.js';
import { CreateHangHoaDto } from './create-hang-hoa.dto.js';
import { QueryHangHoaDto } from './query-hang-hoa.dto.js';
import { UpdateHangHoaDto } from './update-hang-hoa.dto.js';

const UUID = '7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11';

async function check<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
) {
  const dto = plainToInstance(cls, plain);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: errors.map((e) => e.property).sort() };
}

const valid = {
  tenSP: 'Paracetamol 500mg',
  loaiHangId: UUID,
  donViCoBan: 'viên',
};

describe('CreateHangHoaDto', () => {
  it('tối thiểu hợp lệ; chuỗi được cắt khoảng trắng', async () => {
    const { dto, fields } = await check(CreateHangHoaDto, {
      ...valid,
      tenSP: '  Para  ',
      donViCoBan: ' viên ',
    });
    expect(fields).toEqual([]);
    expect(dto).toMatchObject({ tenSP: 'Para', donViCoBan: 'viên' });
  });

  it('đầy đủ trường hợp lệ', async () => {
    const { fields } = await check(CreateHangHoaDto, {
      ...valid,
      quyCach: 'Hộp 10 vỉ',
      cacDonViKhac: [{ donViTinh: 'vỉ', soLuongQuyDoi: 10 }],
      donViTinhGia: 'vỉ',
      giaNhap: '1250.5',
      giaHienThi: '1500',
      giaToiThieu: '1400.00',
      isKeDon: true,
      isCanGiuLanh: false,
      loaiKiemSoat: 'ke_don',
      soDangKy: 'VD-1',
      ghiChu: 'ok',
    });
    expect(fields).toEqual([]);
  });

  it.each([
    ['thiếu tenSP', { tenSP: undefined }, 'tenSP'],
    ['tenSP toàn khoảng trắng', { tenSP: '   ' }, 'tenSP'],
    ['tenSP quá 200 ký tự', { tenSP: 'x'.repeat(201) }, 'tenSP'],
    ['loaiHangId không phải UUID', { loaiHangId: '123' }, 'loaiHangId'],
    ['thiếu donViCoBan', { donViCoBan: undefined }, 'donViCoBan'],
    ['donViCoBan quá 30 ký tự', { donViCoBan: 'x'.repeat(31) }, 'donViCoBan'],
    ['giá là số thay vì chuỗi', { giaNhap: 1250 }, 'giaNhap'],
    ['giá âm', { giaHienThi: '-1' }, 'giaHienThi'],
    ['giá 3 chữ số thập phân', { giaToiThieu: '1.234' }, 'giaToiThieu'],
    ['loaiKiemSoat sai', { loaiKiemSoat: 'khac' }, 'loaiKiemSoat'],
    ['soDangKy quá 50 ký tự', { soDangKy: 'x'.repeat(51) }, 'soDangKy'],
    ['ghiChu quá 500 ký tự', { ghiChu: 'x'.repeat(501) }, 'ghiChu'],
    ['isKeDon không phải boolean', { isKeDon: 'true' }, 'isKeDon'],
  ])('từ chối: %s', async (_name, override, field) => {
    const { fields } = await check(CreateHangHoaDto, { ...valid, ...override });
    expect(fields).toContain(field);
  });

  it('cacDonViKhac: tối đa 10 phần tử, hệ số/tên được kiểm từng phần tử', async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      donViTinh: `d${i}`,
      soLuongQuyDoi: 2 + i,
    }));
    expect(
      (await check(CreateHangHoaDto, { ...valid, cacDonViKhac: many })).fields,
    ).toContain('cacDonViKhac');
    expect(
      (
        await check(CreateHangHoaDto, {
          ...valid,
          cacDonViKhac: [{ donViTinh: '', soLuongQuyDoi: 0 }],
        })
      ).fields,
    ).toContain('cacDonViKhac');
  });

  it('từ chối trường thừa (maSP, trangThai, createdById)', async () => {
    const { fields } = await check(CreateHangHoaDto, {
      ...valid,
      maSP: 'SP99999',
      trangThai: true,
      createdById: UUID,
    });
    expect(fields).toEqual(
      expect.arrayContaining(['maSP', 'trangThai', 'createdById']),
    );
  });
});

describe('UpdateHangHoaDto', () => {
  it('mọi trường tùy chọn; có trangThai', async () => {
    expect((await check(UpdateHangHoaDto, {})).fields).toEqual([]);
    expect(
      (await check(UpdateHangHoaDto, { trangThai: false, giaHienThi: '1' }))
        .fields,
    ).toEqual([]);
  });

  it.each(['maSP', 'donViCoBan', 'cacDonViKhac'])(
    'không cho sửa %s qua endpoint này',
    async (field) => {
      const { fields } = await check(UpdateHangHoaDto, {
        [field]: field === 'cacDonViKhac' ? [] : 'x',
      });
      expect(fields).toContain(field);
    },
  );
});

describe('QueryHangHoaDto', () => {
  it('đổi chuỗi query thành boolean; loaiKiemSoat phải thuộc enum', async () => {
    const { dto, fields } = await check(QueryHangHoaDto, {
      isKeDon: 'true',
      isCanGiuLanh: 'false',
      loaiKiemSoat: 'ke_don',
    });
    expect(fields).toEqual([]);
    expect(dto).toMatchObject({ isKeDon: true, isCanGiuLanh: false });
    expect(
      (await check(QueryHangHoaDto, { loaiKiemSoat: 'x' })).fields,
    ).toContain('loaiKiemSoat');
    expect(
      (await check(QueryHangHoaDto, { loaiHangId: 'x' })).fields,
    ).toContain('loaiHangId');
  });
});

describe('CreateLoaiHangDto / UpdateLoaiHangDto', () => {
  it('tên bắt buộc, tối đa 100 ký tự, được cắt khoảng trắng', async () => {
    expect(
      (await check(CreateLoaiHangDto, { tenLoaiHang: '  Kháng sinh ' })).dto
        .tenLoaiHang,
    ).toBe('Kháng sinh');
    expect((await check(CreateLoaiHangDto, {})).fields).toContain(
      'tenLoaiHang',
    );
    expect(
      (await check(CreateLoaiHangDto, { tenLoaiHang: '  ' })).fields,
    ).toContain('tenLoaiHang');
    expect(
      (await check(CreateLoaiHangDto, { tenLoaiHang: 'x'.repeat(101) })).fields,
    ).toContain('tenLoaiHang');
    expect(
      (
        await check(CreateLoaiHangDto, {
          tenLoaiHang: 'A',
          ghiChu: 'x'.repeat(501),
        })
      ).fields,
    ).toContain('ghiChu');
  });

  it('update: mọi trường tùy chọn, có trangThai, ghiChu = null hợp lệ', async () => {
    expect((await check(UpdateLoaiHangDto, {})).fields).toEqual([]);
    expect(
      (await check(UpdateLoaiHangDto, { trangThai: false, ghiChu: null }))
        .fields,
    ).toEqual([]);
  });
});

describe('CreateTyLeQuyDoiDto / QueryTyLeQuyDoiDto', () => {
  it('hợp lệ; hệ số 1 được qua DTO (service trả lỗi rõ hơn); 0 / âm / thập phân bị từ chối', async () => {
    expect(
      (
        await check(CreateTyLeQuyDoiDto, {
          donViTinh: 'hộp',
          soLuongQuyDoi: 100,
        })
      ).fields,
    ).toEqual([]);
    expect(
      (await check(CreateTyLeQuyDoiDto, { donViTinh: 'hộp', soLuongQuyDoi: 1 }))
        .fields,
    ).toEqual([]);
    for (const soLuongQuyDoi of [0, -5, 2.5, 1_000_001]) {
      expect(
        (await check(CreateTyLeQuyDoiDto, { donViTinh: 'hộp', soLuongQuyDoi }))
          .fields,
      ).toContain('soLuongQuyDoi');
    }
    expect(
      (await check(CreateTyLeQuyDoiDto, { donViTinh: '', soLuongQuyDoi: 5 }))
        .fields,
    ).toContain('donViTinh');
  });

  it('danh sách đơn vị mặc định pageSize 50', async () => {
    expect((await check(QueryTyLeQuyDoiDto, {})).dto.pageSize).toBe(50);
  });
});
