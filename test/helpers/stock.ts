import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../src/prisma/prisma.service.js';

// Puts `soLuong` units of a brand-new product (and lot) into a location, straight through
// Prisma, so location/warehouse rules can be tested before the stock module exists.
export async function seedStock(
  prisma: PrismaService,
  options: { viTriId: string; soLuong: number; isCanGiuLanh?: boolean },
): Promise<{ hangHoaId: string; soLoId: string; tonKhoId: string }> {
  const suffix = randomUUID().slice(0, 8);
  const loaiHang = await prisma.loaiHang.create({
    data: { tenLoaiHang: `Loại ${suffix}` },
  });
  const hangHoa = await prisma.hangHoa.create({
    data: {
      maSP: `T${suffix}`,
      tenSP: `Hàng ${suffix}`,
      donViTinhGia: 'viên',
      isCanGiuLanh: options.isCanGiuLanh ?? false,
      loaiHangId: loaiHang.id,
      tyLeQuyDois: { create: [{ donViTinh: 'viên', soLuongQuyDoi: 1 }] },
    },
  });
  const soLo = await prisma.soLo.create({
    data: {
      tenLo: `L-${suffix}`,
      hanSuDung: new Date('2030-12-31'),
      hangHoaId: hangHoa.id,
    },
  });
  const tonKho = await prisma.tonKho.create({
    data: {
      soLoId: soLo.id,
      viTriId: options.viTriId,
      soLuong: options.soLuong,
    },
  });
  return { hangHoaId: hangHoa.id, soLoId: soLo.id, tonKhoId: tonKho.id };
}
