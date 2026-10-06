import { execSync } from 'node:child_process';
import bcrypt from 'bcrypt';
import { ROLE_META } from '../../src/auth/roles.constants.js';
import type { PrismaService } from '../../src/prisma/prisma.service.js';

export const TEST_PASSWORD = 'Test@12345';

export function assertTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  if (!/_test(\?|$)/.test(url)) {
    throw new Error(
      'DATABASE_URL không trỏ tới DB test (tên phải kết thúc bằng _test); từ chối xóa dữ liệu.',
    );
  }
}

export function migrateTestDatabase(): void {
  assertTestDatabase();
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: process.env,
  });
}

export interface SeededRoles {
  ADMIN: string;
  QUAN_LY_KHO: string;
  NHAN_VIEN_KHO: string;
  KE_TOAN: string;
}

// Wipes the test database tables used so far and seeds 4 roles and 6 users
// (admin, quanly, kho, ketoan, locked, tam). The NV counter is set so users
// created through the API start at NV0007.
export async function resetAndSeed(
  prisma: PrismaService,
): Promise<SeededRoles> {
  assertTestDatabase();
  await prisma.nhatKyHeThong.deleteMany();
  await prisma.phieuXuatHang.deleteMany();
  await prisma.phieuNhapHang.deleteMany();
  await prisma.bienDongTonKho.deleteMany();
  await prisma.tonKho.deleteMany();
  await prisma.soLo.deleteMany();
  await prisma.viTri.deleteMany();
  await prisma.kho.deleteMany();
  await prisma.khachHang.deleteMany();
  await prisma.nhaCungCap.deleteMany();
  await prisma.phuongTienVanChuyen.deleteMany();
  await prisma.tyLeQuyDoi.deleteMany();
  await prisma.hangHoa.deleteMany();
  await prisma.loaiHang.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.boDemMa.deleteMany();

  const created = {} as SeededRoles;
  for (const maRole of Object.keys(ROLE_META) as (keyof SeededRoles)[]) {
    const role = await prisma.role.create({
      data: { maRole, ...ROLE_META[maRole] },
    });
    created[maRole] = role.id;
  }

  const password = await bcrypt.hash(TEST_PASSWORD, 4);
  const users = [
    ['NV0001', 'admin', 'Quản trị viên', 'ADMIN', true],
    ['NV0002', 'kho', 'Nhân viên kho', 'NHAN_VIEN_KHO', true],
    ['NV0003', 'locked', 'Đã khóa', 'NHAN_VIEN_KHO', false],
    ['NV0004', 'tam', 'Tạm thời', 'NHAN_VIEN_KHO', true],
    ['NV0005', 'quanly', 'Quản lý kho', 'QUAN_LY_KHO', true],
    ['NV0006', 'ketoan', 'Kế toán', 'KE_TOAN', true],
  ] as const;
  await prisma.user.createMany({
    data: users.map(([maNV, username, hoTen, maRole, trangThai]) => ({
      maNV,
      username,
      hoTen,
      password,
      roleId: created[maRole],
      trangThai,
    })),
  });
  await prisma.boDemMa.create({ data: { tienTo: 'NV', ngay: '', giaTri: 6 } });
  return created;
}
