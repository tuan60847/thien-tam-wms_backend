import type { NextFunction, Request, Response } from 'express';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  RequestContext,
  RequestContextMiddleware,
} from '../common/request-context/request-context.js';
import { AuditService } from './audit.service.js';

function setup() {
  const create = vi.fn().mockResolvedValue({ id: 'log-1' });
  const prisma = { nhatKyHeThong: { create } } as unknown as PrismaService;
  return { service: new AuditService(prisma), create };
}

function withRequest<T>(
  req: Partial<Request> & Record<string, unknown>,
  fn: () => T,
): T {
  let result!: T;
  new RequestContextMiddleware().use(
    req as Request,
    {} as Response,
    (() => {
      result = fn();
    }) as NextFunction,
  );
  return result;
}

describe('AuditService', () => {
  it('ghi thao tác kèm userId, ip, requestId lấy từ request hiện tại', async () => {
    const { service, create } = setup();
    await withRequest({ id: 'req-9', ip: '10.0.0.5', user: { id: 'u1' } }, () =>
      service.record({
        hanhDong: 'phieu_xuat.cancel_after_issue',
        doiTuong: 'phieu_xuat_hang',
        doiTuongId: 'p1',
        truoc: { trangThai: 'da_xuat_kho' },
        sau: { trangThai: 'da_huy' },
        lyDo: 'Nhập nhầm',
      }),
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        hanhDong: 'phieu_xuat.cancel_after_issue',
        doiTuong: 'phieu_xuat_hang',
        doiTuongId: 'p1',
        truoc: { trangThai: 'da_xuat_kho' },
        sau: { trangThai: 'da_huy' },
        lyDo: 'Nhập nhầm',
        userId: 'u1',
        ip: '10.0.0.5',
        requestId: 'req-9',
      },
    });
  });

  it('ngoài request (job, seed) → userId/ip/requestId là null', async () => {
    const { service, create } = setup();
    await service.record({ hanhDong: 'job.run', doiTuong: 'job' });
    expect(create.mock.calls[0]![0].data).toMatchObject({
      userId: null,
      ip: null,
      requestId: null,
      doiTuongId: null,
      lyDo: null,
    });
  });

  it('dùng transaction của nơi gọi khi được truyền vào', async () => {
    const { service, create } = setup();
    const txCreate = vi.fn().mockResolvedValue({});
    await service.record({ hanhDong: 'x.y', doiTuong: 'x' }, {
      nhatKyHeThong: { create: txCreate },
    } as never);
    expect(txCreate).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('RequestContext', () => {
  it('không có request → null hết', () => {
    expect(RequestContext.requestId()).toBeNull();
    expect(RequestContext.ip()).toBeNull();
    expect(RequestContext.userId()).toBeNull();
  });

  it('userId đọc muộn: gán sau khi middleware chạy (guard xác thực xong) vẫn thấy', () => {
    const req: Record<string, unknown> = { id: 'r1' };
    const seen = withRequest(req, () => {
      req.user = { id: 'late-user' };
      return RequestContext.userId();
    });
    expect(seen).toBe('late-user');
  });
});
