import type { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  const findUnique = vi.fn();
  const prisma = { user: { findUnique } } as unknown as PrismaService;
  const service = new UsersService(prisma);

  it('findByUsername tìm theo username và kèm role', async () => {
    findUnique.mockResolvedValue({ id: 'u1' });
    await expect(service.findByUsername('admin')).resolves.toEqual({
      id: 'u1',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { username: 'admin' },
      include: { role: true },
    });
  });

  it('findById tìm theo id và kèm role', async () => {
    findUnique.mockResolvedValue({ id: 'u1' });
    await service.findById('u1');
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      include: { role: true },
    });
  });

  it('trả null khi không có user', async () => {
    findUnique.mockResolvedValue(null);
    await expect(service.findById('nope')).resolves.toBeNull();
  });
});
