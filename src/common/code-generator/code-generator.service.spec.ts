import type { PrismaService } from '../../prisma/prisma.service.js';
import type { ClockService } from '../clock/clock.service.js';
import { CodeGeneratorService } from './code-generator.service.js';
import { CODE } from './code-specs.js';

interface Row {
  tienTo: string;
  ngay: string;
  giaTri: number;
}

// Fake that understands the raw statements the service issues. Template values arrive
// in order: increment -> (tienTo, ngay); select -> (tienTo, ngay);
// ensureAtLeast -> (prefix, floor, floor).
function setup() {
  const rows: Row[] = [];
  const find = (tienTo: string, ngay: string) =>
    rows.find((r) => r.tienTo === tienTo && r.ngay === ngay);

  const executeRaw = vi.fn(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (strings.join('?').includes('GREATEST')) {
        const [tienTo, floor] = values as [string, number];
        const row = find(tienTo, '');
        if (row) {
          row.giaTri = Math.max(row.giaTri, floor);
        } else {
          rows.push({ tienTo, ngay: '', giaTri: floor });
        }
        return 1;
      }
      const [tienTo, ngay] = values as [string, string];
      const row = find(tienTo, ngay);
      if (row) {
        row.giaTri += 1;
      } else {
        rows.push({ tienTo, ngay, giaTri: 1 });
      }
      return 1;
    },
  );
  const queryRaw = vi.fn(
    async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const [tienTo, ngay] = values as [string, string];
      const row = find(tienTo, ngay);
      return row ? [{ gia_tri: row.giaTri }] : [];
    },
  );
  const client = { $executeRaw: executeRaw, $queryRaw: queryRaw };
  const transaction = vi.fn(
    async (fn: (t: typeof client) => Promise<unknown>) => fn(client),
  );
  const prisma = {
    ...client,
    $transaction: transaction,
  } as unknown as PrismaService;
  let nowValue = new Date('2026-10-01T03:00:00Z');
  const clock = { now: () => nowValue } as unknown as ClockService;
  return {
    service: new CodeGeneratorService(prisma, clock),
    rows,
    client,
    executeRaw,
    queryRaw,
    transaction,
    setNow: (iso: string) => {
      nowValue = new Date(iso);
    },
  };
}

describe('CodeGeneratorService', () => {
  it('mã đầu tiên trong ngày kết thúc bằng 0001 và tăng dần', async () => {
    const { service } = setup();
    expect(await service.next(CODE.PHIEU_NHAP)).toBe('PN2610010001');
    expect(await service.next(CODE.PHIEU_NHAP)).toBe('PN2610010002');
    expect(await service.next(CODE.PHIEU_NHAP)).toBe('PN2610010003');
  });

  it('bộ đếm theo tiền tố độc lập nhau', async () => {
    const { service } = setup();
    await service.next(CODE.PHIEU_NHAP);
    expect(await service.next(CODE.PHIEU_XUAT)).toBe('PX2610010001');
  });

  it('reset sang số 1 khi sang ngày mới theo giờ VN', async () => {
    const { service, setNow } = setup();
    await service.next(CODE.PHIEU_NHAP);
    await service.next(CODE.PHIEU_NHAP);
    setNow('2026-10-01T16:59:00Z'); // vẫn 01/10 giờ VN
    expect(await service.next(CODE.PHIEU_NHAP)).toBe('PN2610010003');
    setNow('2026-10-01T17:00:00Z'); // 00:00 ngày 02/10 giờ VN
    expect(await service.next(CODE.PHIEU_NHAP)).toBe('PN2610020001');
  });

  it('mã liên tục (không theo ngày) không reset khi sang ngày', async () => {
    const { service, setNow } = setup();
    expect(await service.next(CODE.KHACH_HANG)).toBe('KH00001');
    setNow('2026-10-05T03:00:00Z');
    expect(await service.next(CODE.KHACH_HANG)).toBe('KH00002');
  });

  it('không có tx → tự mở một transaction ngắn; có tx → dùng lại tx của nơi gọi', async () => {
    const { service, client, transaction } = setup();
    await service.next(CODE.NHAN_VIEN);
    expect(transaction).toHaveBeenCalledTimes(1);

    await service.next(CODE.NHAN_VIEN, client as never);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('mỗi lần lấy mã chỉ dùng đúng một câu INSERT ... ON DUPLICATE KEY UPDATE rồi một SELECT', async () => {
    const { service, executeRaw, queryRaw } = setup();
    await service.next(CODE.SAN_PHAM);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('ensureAtLeast nâng bộ đếm lên mức tối thiểu, không bao giờ hạ xuống', async () => {
    const { service, rows } = setup();
    await service.ensureAtLeast(CODE.NHAN_VIEN, 1);
    expect(rows).toEqual([{ tienTo: 'NV', ngay: '', giaTri: 1 }]);
    await service.ensureAtLeast(CODE.NHAN_VIEN, 10);
    expect(rows[0]!.giaTri).toBe(10);
    await service.ensureAtLeast(CODE.NHAN_VIEN, 3);
    expect(rows[0]!.giaTri).toBe(10);
    expect(await service.next(CODE.NHAN_VIEN)).toBe('NV0011');
  });
});
