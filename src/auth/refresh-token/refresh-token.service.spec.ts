import type { PrismaService } from '../../prisma/prisma.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

function setup() {
  const updateMany = vi.fn().mockResolvedValue({ count: 3 });
  const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
  const prisma = {
    refreshToken: { updateMany, deleteMany },
  } as unknown as PrismaService;
  return { service: new RefreshTokenService(prisma), updateMany, deleteMany };
}

describe('RefreshTokenService', () => {
  it('revokeAllForUser thu hồi mọi token còn hiệu lực của user và trả số dòng', async () => {
    const { service, updateMany } = setup();
    await expect(service.revokeAllForUser('u1')).resolves.toBe(3);
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revokeAllForUser dùng transaction của nơi gọi khi được truyền vào', async () => {
    const { service, updateMany } = setup();
    const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    await service.revokeAllForUser('u1', {
      refreshToken: { updateMany: txUpdateMany },
    } as never);
    expect(txUpdateMany).toHaveBeenCalledOnce();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('purgeExpired chỉ xóa token hết hạn trước mốc cho trước', async () => {
    const { service, deleteMany } = setup();
    const before = new Date('2026-09-01T00:00:00Z');
    await expect(service.purgeExpired(before)).resolves.toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: before } },
    });
  });
});
