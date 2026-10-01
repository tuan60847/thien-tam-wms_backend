import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcrypt';
import { ROLE, ROLE_META, type RoleCode } from '../src/auth/roles.constants.js';

const BCRYPT_COST = 10;

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
});

// Production must set SEED_ADMIN_PASSWORD; dev/test fall back to a known default.
function adminPassword(): string {
  const fromEnv = process.env.SEED_ADMIN_PASSWORD;
  if (fromEnv) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cần đặt SEED_ADMIN_PASSWORD khi seed ở production');
  }
  return 'Admin@123';
}

async function main() {
  const roles = new Map<RoleCode, string>();
  for (const maRole of Object.values(ROLE)) {
    const role = await prisma.role.upsert({
      where: { maRole },
      update: {},
      create: { maRole, ...ROLE_META[maRole] },
    });
    roles.set(maRole, role.id);
  }
  const adminRoleId = roles.get(ROLE.ADMIN)!;

  // Do not overwrite the password on later runs, so a changed password is not reset.
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { roleId: adminRoleId },
    create: {
      maNV: 'NV0001',
      username: 'admin',
      hoTen: 'Quản trị viên',
      password: await bcrypt.hash(adminPassword(), BCRYPT_COST),
      roleId: adminRoleId,
    },
  });

  // Keep the NV counter ahead of existing codes so new users get NV0002, NV0003...
  const codes = await prisma.user.findMany({ select: { maNV: true } });
  const highest = Math.max(
    1,
    ...codes.map((u) => Number(/^NV(\d+)$/.exec(u.maNV)?.[1] ?? 0)),
  );
  await prisma.boDemMa.upsert({
    where: { tienTo_ngay: { tienTo: 'NV', ngay: '' } },
    update: {},
    create: { tienTo: 'NV', ngay: '', giaTri: highest },
  });
  await prisma.boDemMa.updateMany({
    where: { tienTo: 'NV', ngay: '', giaTri: { lt: highest } },
    data: { giaTri: highest },
  });

  process.stdout.write(
    `Seed xong: ${admin.username} (${admin.maNV}) - role ${ROLE.ADMIN}\n`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
