import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcrypt';

const BCRYPT_COST = 10;

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { maRole: 'ADMIN' },
    update: {},
    create: {
      maRole: 'ADMIN',
      tenRole: 'Quản trị viên',
      moTa: 'Toàn quyền hệ thống',
    },
  });

  await prisma.role.upsert({
    where: { maRole: 'NHAN_VIEN_KHO' },
    update: {},
    create: {
      maRole: 'NHAN_VIEN_KHO',
      tenRole: 'Nhân viên kho',
      moTa: 'Nhập, xuất và kiểm kê hàng hóa',
    },
  });

  // Không ghi đè mật khẩu ở lần chạy sau, tránh reset mật khẩu đã đổi.
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { roleId: adminRole.id },
    create: {
      maNV: 'NV0001',
      username: 'admin',
      hoTen: 'Quản trị viên',
      password: await bcrypt.hash('Admin@123', BCRYPT_COST),
      roleId: adminRole.id,
    },
  });

  process.stdout.write(`Seed xong: ${admin.username} (${admin.maNV}) - role ${adminRole.maRole}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
