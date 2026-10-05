import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateKhachHangDto,
  QueryKhachHangDto,
  UpdateKhachHangDto,
} from '../khach-hang/dto/khach-hang.dto.js';
import {
  CreateKhoDto,
  QueryKhoDto,
  UpdateKhoDto,
} from '../kho-vi-tri/dto/kho.dto.js';
import {
  CreateViTriDto,
  QueryViTriDto,
  UpdateViTriDto,
} from '../kho-vi-tri/dto/vi-tri.dto.js';
import {
  CreateNhaCungCapDto,
  QueryNhaCungCapDto,
  UpdateNhaCungCapDto,
  XacMinhNhaCungCapDto,
} from '../nha-cung-cap/dto/nha-cung-cap.dto.js';
import {
  CreatePhuongTienDto,
  UpdatePhuongTienDto,
} from '../phuong-tien-van-chuyen/dto/phuong-tien.dto.js';

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

describe('Kho DTO', () => {
  it('tạo: tên bắt buộc ≤ 100, địa chỉ ≤ 255; tên được cắt khoảng trắng', async () => {
    expect(
      (await check(CreateKhoDto, { tenKho: '  Kho chính ' })).dto.tenKho,
    ).toBe('Kho chính');
    expect((await check(CreateKhoDto, {})).fields).toContain('tenKho');
    expect(
      (await check(CreateKhoDto, { tenKho: 'x'.repeat(101) })).fields,
    ).toContain('tenKho');
    expect(
      (await check(CreateKhoDto, { tenKho: 'A', diaChi: 'x'.repeat(256) }))
        .fields,
    ).toContain('diaChi');
  });

  it('sửa: mọi trường tùy chọn, có trangThai; query nhận boolean dạng chuỗi', async () => {
    expect((await check(UpdateKhoDto, { trangThai: false })).fields).toEqual(
      [],
    );
    expect(
      (await check(QueryKhoDto, { trangThai: 'false' })).dto.trangThai,
    ).toBe(false);
    expect((await check(QueryKhoDto, { trangThai: 'x' })).fields).toContain(
      'trangThai',
    );
  });
});

describe('Vị trí DTO', () => {
  it('tạo hợp lệ; thiếu khoId / khoId sai / tên rỗng / tên > 50 bị từ chối', async () => {
    expect(
      (
        await check(CreateViTriDto, {
          khoId: UUID,
          tenViTri: 'A-01',
          isCapDong: true,
        })
      ).fields,
    ).toEqual([]);
    expect((await check(CreateViTriDto, { tenViTri: 'A' })).fields).toContain(
      'khoId',
    );
    expect(
      (await check(CreateViTriDto, { khoId: '123', tenViTri: 'A' })).fields,
    ).toContain('khoId');
    expect(
      (await check(CreateViTriDto, { khoId: UUID, tenViTri: '  ' })).fields,
    ).toContain('tenViTri');
    expect(
      (await check(CreateViTriDto, { khoId: UUID, tenViTri: 'x'.repeat(51) }))
        .fields,
    ).toContain('tenViTri');
  });

  it('sửa: không cho đổi khoId; có trangThai', async () => {
    expect((await check(UpdateViTriDto, { khoId: UUID })).fields).toContain(
      'khoId',
    );
    expect(
      (await check(UpdateViTriDto, { isCapDong: false, trangThai: true }))
        .fields,
    ).toEqual([]);
  });

  it('query: isCapDong / trangThai dạng chuỗi, khoId phải là UUID', async () => {
    const { dto, fields } = await check(QueryViTriDto, {
      isCapDong: 'true',
      trangThai: 'false',
      khoId: UUID,
    });
    expect(fields).toEqual([]);
    expect(dto).toMatchObject({ isCapDong: true, trangThai: false });
    expect((await check(QueryViTriDto, { khoId: 'x' })).fields).toContain(
      'khoId',
    );
  });
});

describe('Khách hàng DTO', () => {
  const valid = { tenKH: 'Nhà thuốc Minh Châu' };

  it('hợp lệ đầy đủ; SĐT được chuẩn hóa; email chuyển chữ thường', async () => {
    const { dto, fields } = await check(CreateKhachHangDto, {
      ...valid,
      maSoThue: '0312345678-001',
      email: ' A@B.VN ',
      SDT: '0901 234 567',
      SDTNDD: '+84 901 234 568',
      nguoiDaiDien: 'Nguyễn A',
      soGiayPhepKinhDoanh: 'GP-1',
      ngayCapGPKD: '2024-01-15',
      ngayHetHanGPKD: '2029-01-15',
    });
    expect(fields).toEqual([]);
    expect(dto).toMatchObject({
      email: 'a@b.vn',
      SDT: '0901234567',
      SDTNDD: '+84901234568',
    });
  });

  it.each([
    ['thiếu tên', { tenKH: undefined }, 'tenKH'],
    ['MST sai', { maSoThue: '123' }, 'maSoThue'],
    ['SĐT sai', { SDT: '12345' }, 'SDT'],
    ['SĐT người đại diện sai', { SDTNDD: 'abc' }, 'SDTNDD'],
    ['email sai', { email: 'khong-phai-email' }, 'email'],
    ['ngày sai định dạng', { ngayCapGPKD: '15/01/2024' }, 'ngayCapGPKD'],
    ['ngày không có thật', { ngayHetHanGPKD: '2026-02-30' }, 'ngayHetHanGPKD'],
    ['tên quá 200 ký tự', { tenKH: 'x'.repeat(201) }, 'tenKH'],
  ])('từ chối: %s', async (_n, override, field) => {
    const { fields } = await check(CreateKhachHangDto, {
      ...valid,
      ...override,
    });
    expect(fields).toContain(field);
  });

  it('cho phép null để xóa trường tùy chọn khi sửa; từ chối maKH và trangThai sai', async () => {
    expect(
      (
        await check(UpdateKhachHangDto, {
          email: null,
          SDT: null,
          ngayHetHanGPKD: null,
          maSoThue: null,
        })
      ).fields,
    ).toEqual([]);
    expect(
      (await check(UpdateKhachHangDto, { maKH: 'KH99999' })).fields,
    ).toContain('maKH');
    expect(
      (await check(UpdateKhachHangDto, { trangThai: 'khac' })).fields,
    ).toContain('trangThai');
    expect(
      (await check(UpdateKhachHangDto, { trangThai: 'ngung_hoat_dong' }))
        .fields,
    ).toEqual([]);
  });

  it('query: giayPhep và trangThai phải thuộc enum', async () => {
    expect(
      (
        await check(QueryKhachHangDto, {
          giayPhep: 'sap_het_han',
          trangThai: 'hoat_dong',
        })
      ).fields,
    ).toEqual([]);
    expect(
      (await check(QueryKhachHangDto, { giayPhep: 'x' })).fields,
    ).toContain('giayPhep');
    expect(
      (await check(QueryKhachHangDto, { trangThai: 'x' })).fields,
    ).toContain('trangThai');
  });
});

describe('Nhà cung cấp DTO', () => {
  it('tạo hợp lệ; thiếu tên / SĐT sai / ngày sai bị từ chối', async () => {
    expect(
      (
        await check(CreateNhaCungCapDto, {
          tenNCC: 'Dược Hậu Giang',
          SDT: '0292 3891 433',
          soGiayPhepKinhDoanh: 'GP-1',
          ngayCapGPKD: '2024-01-01',
          ngayHetHanGPKD: '2029-01-01',
          soGCNDuDieuKienKinhDoanhDuoc: 'GCN-1',
          ngayCapGCNDuoc: '2024-01-01',
          ngayHetHanGCNDuoc: '2029-01-01',
        })
      ).fields,
    ).toEqual([]);
    expect((await check(CreateNhaCungCapDto, {})).fields).toContain('tenNCC');
    expect(
      (await check(CreateNhaCungCapDto, { tenNCC: 'A', SDT: '1' })).fields,
    ).toContain('SDT');
    expect(
      (
        await check(CreateNhaCungCapDto, {
          tenNCC: 'A',
          ngayHetHanGCNDuoc: 'x',
        })
      ).fields,
    ).toContain('ngayHetHanGCNDuoc');
  });

  it('không cho gửi maNCC / trangThaiXacMinh khi tạo hay sửa', async () => {
    expect(
      (await check(CreateNhaCungCapDto, { tenNCC: 'A', maNCC: 'NCC9999' }))
        .fields,
    ).toContain('maNCC');
    expect(
      (await check(UpdateNhaCungCapDto, { trangThaiXacMinh: 'da_xac_minh' }))
        .fields,
    ).toContain('trangThaiXacMinh');
    expect(
      (await check(UpdateNhaCungCapDto, { trangThai: false })).fields,
    ).toEqual([]);
  });

  it('xác minh: ketQua phải thuộc {da_xac_minh, tu_choi}; từ chối bắt buộc có lý do', async () => {
    expect(
      (await check(XacMinhNhaCungCapDto, { ketQua: 'da_xac_minh' })).fields,
    ).toEqual([]);
    expect(
      (
        await check(XacMinhNhaCungCapDto, {
          ketQua: 'tu_choi',
          ghiChu: 'Hồ sơ giả',
        })
      ).fields,
    ).toEqual([]);
    expect(
      (await check(XacMinhNhaCungCapDto, { ketQua: 'tu_choi' })).fields,
    ).toContain('ghiChu');
    expect(
      (await check(XacMinhNhaCungCapDto, { ketQua: 'tu_choi', ghiChu: '  ' }))
        .fields,
    ).toContain('ghiChu');
    expect(
      (await check(XacMinhNhaCungCapDto, { ketQua: 'chua_xac_minh' })).fields,
    ).toContain('ketQua');
    expect((await check(XacMinhNhaCungCapDto, {})).fields).toContain('ketQua');
  });

  it('query: lọc theo trạng thái xác minh phải thuộc enum', async () => {
    expect(
      (
        await check(QueryNhaCungCapDto, {
          trangThaiXacMinh: 'da_xac_minh',
          trangThai: 'true',
        })
      ).fields,
    ).toEqual([]);
    expect(
      (await check(QueryNhaCungCapDto, { trangThaiXacMinh: 'x' })).fields,
    ).toContain('trangThaiXacMinh');
  });
});

describe('Phương tiện DTO', () => {
  it('biển số được chuẩn hóa rồi mới kiểm tra', async () => {
    const { dto, fields } = await check(CreatePhuongTienDto, {
      bienSo: '51c-123.45',
      loaiPhuongTien: ' Xe tải ',
      isXeLanh: true,
    });
    expect(fields).toEqual([]);
    expect(dto).toMatchObject({
      bienSo: '51C12345',
      loaiPhuongTien: 'Xe tải',
      isXeLanh: true,
    });
  });

  it.each(['', 'abc', '51C', '51C-12', 'xx-12345'])(
    'từ chối biển số %j',
    async (bienSo) => {
      expect((await check(CreatePhuongTienDto, { bienSo })).fields).toContain(
        'bienSo',
      );
    },
  );

  it('sửa: mọi trường tùy chọn, có trangThai; isXeLanh phải là boolean', async () => {
    expect(
      (await check(UpdatePhuongTienDto, { trangThai: false })).fields,
    ).toEqual([]);
    expect(
      (await check(UpdatePhuongTienDto, { isXeLanh: 'yes' })).fields,
    ).toContain('isXeLanh');
  });
});
