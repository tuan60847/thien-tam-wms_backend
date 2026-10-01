import { execSync } from 'node:child_process';
import bcrypt from 'bcrypt';
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

export async function resetAndSeed(prisma: PrismaService): Promise<void> {
  assertTestDatabase();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  const [admin, nhanVien] = await Promise.all([
    prisma.role.create({
      data: { maRole: 'ADMIN', tenRole: 'Quản trị viên' },
    }),
    prisma.role.create({
      data: { maRole: 'NHAN_VIEN_KHO', tenRole: 'Nhân viên kho' },
    }),
  ]);

  const password = await bcrypt.hash(TEST_PASSWORD, 4);
  await prisma.user.createMany({
    data: [
      {
        maNV: 'NV0001',
        username: 'admin',
        hoTen: 'Quản trị viên',
        password,
        roleId: admin.id,
      },
      {
        maNV: 'NV0002',
        username: 'kho',
        hoTen: 'Nhân viên kho',
        password,
        roleId: nhanVien.id,
      },
      {
        maNV: 'NV0003',
        username: 'locked',
        hoTen: 'Đã khóa',
        password,
        roleId: nhanVien.id,
        trangThai: false,
      },
      {
        maNV: 'NV0004',
        username: 'tam',
        hoTen: 'Tạm thời',
        password,
        roleId: nhanVien.id,
      },
    ],
  });
}
