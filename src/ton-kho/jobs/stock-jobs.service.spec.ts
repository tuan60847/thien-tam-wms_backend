import type { SchedulerRegistry } from '@nestjs/schedule';
import type { SoLoService } from '../../so-lo/so-lo.service.js';
import type { TonKhoQueryService } from '../ton-kho-query.service.js';
import { StockJobsService } from './stock-jobs.service.js';

function setup(over: { jobsEnabled?: boolean; soDongLech?: number } = {}) {
  const refreshExpiryStatuses = vi.fn(async () => ({
    hetHan: 1,
    canDate: 2,
    conHan: 0,
  }));
  const doiSoat = vi.fn(async () => ({
    soDongLech: over.soDongLech ?? 0,
    soDongKiemTra: 5,
  }));
  const addCronJob = vi.fn();
  const deleteCronJob = vi.fn();
  const service = new StockJobsService(
    { refreshExpiryStatuses } as unknown as SoLoService,
    { doiSoat } as unknown as TonKhoQueryService,
    { addCronJob, deleteCronJob } as unknown as SchedulerRegistry,
    {
      jobsEnabled: over.jobsEnabled ?? true,
      jobsTimezone: 'Asia/Ho_Chi_Minh',
    } as never,
  );
  return { service, refreshExpiryStatuses, doiSoat, addCronJob, deleteCronJob };
}

describe('StockJobsService', () => {
  it('bật: đăng ký hai job, tắt module thì gỡ cả hai', () => {
    const { service, addCronJob, deleteCronJob } = setup();
    service.onModuleInit();
    expect(addCronJob.mock.calls.map((c) => c[0])).toEqual([
      'expiry-scan',
      'stock-reconcile',
    ]);
    service.onModuleDestroy();
    expect(deleteCronJob.mock.calls.map((c) => c[0])).toEqual([
      'expiry-scan',
      'stock-reconcile',
    ]);
    // stop the real cron timers created above
    for (const [, job] of addCronJob.mock.calls as [string, { stop(): void }][])
      job.stop();
  });

  it('JOBS_ENABLED=false: không đăng ký gì', () => {
    const { service, addCronJob } = setup({ jobsEnabled: false });
    service.onModuleInit();
    expect(addCronJob).not.toHaveBeenCalled();
  });

  it('expiryScan gọi làm mới trạng thái và trả số dòng đổi', async () => {
    const { service, refreshExpiryStatuses } = setup();
    await expect(service.expiryScan()).resolves.toEqual({
      hetHan: 1,
      canDate: 2,
      conHan: 0,
    });
    expect(refreshExpiryStatuses).toHaveBeenCalledOnce();
  });

  it('reconcile chỉ báo cáo lệch, lỗi của job không văng ra scheduler', async () => {
    const { service, doiSoat } = setup({ soDongLech: 2 });
    await expect(service.reconcile()).resolves.toMatchObject({ soDongLech: 2 });
    doiSoat.mockRejectedValueOnce(new Error('db down'));
    await expect(service.reconcile()).resolves.toBeUndefined();
  });

  it('hai lần chạy chồng nhau: lần sau bị bỏ qua', async () => {
    const { service, refreshExpiryStatuses } = setup();
    let release!: () => void;
    refreshExpiryStatuses.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ hetHan: 0, canDate: 0, conHan: 0 });
        }),
    );
    const first = service.expiryScan();
    await expect(service.expiryScan()).resolves.toBeUndefined();
    release();
    await first;
    expect(refreshExpiryStatuses).toHaveBeenCalledOnce();
  });
});
