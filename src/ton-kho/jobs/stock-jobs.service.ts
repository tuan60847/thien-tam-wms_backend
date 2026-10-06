import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { runExclusive } from '../../common/jobs/job-runner.js';
import { appConfig } from '../../config/app.config.js';
import { SoLoService } from '../../so-lo/so-lo.service.js';
import { TonKhoQueryService } from '../ton-kho-query.service.js';

export const EXPIRY_SCAN_CRON = '5 0 * * *';
export const STOCK_RECONCILE_CRON = '30 2 * * *';

// Jobs are registered at startup (not with @Cron) so the timezone and the on/off switch
// come from typed config instead of process.env read at decoration time.
@Injectable()
export class StockJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StockJobsService.name);
  private readonly names: string[] = [];

  constructor(
    private readonly soLo: SoLoService,
    private readonly tonKho: TonKhoQueryService,
    private readonly registry: SchedulerRegistry,
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  onModuleInit(): void {
    if (!this.config.jobsEnabled) {
      return;
    }
    this.schedule('expiry-scan', EXPIRY_SCAN_CRON, () => this.expiryScan());
    this.schedule('stock-reconcile', STOCK_RECONCILE_CRON, () =>
      this.reconcile(),
    );
  }

  onModuleDestroy(): void {
    for (const name of this.names) {
      this.registry.deleteCronJob(name);
    }
  }

  // Refreshes the cached lot status column from the expiry date.
  expiryScan() {
    return runExclusive('expiry-scan', async () => {
      const counts = await this.soLo.refreshExpiryStatuses();
      this.logger.log(`expiry-scan updated ${JSON.stringify(counts)}`);
      return counts;
    });
  }

  // Reports ledger mismatches; never repairs them.
  reconcile() {
    return runExclusive('stock-reconcile', async () => {
      const result = await this.tonKho.doiSoat();
      if (result.soDongLech > 0) {
        this.logger.error(
          `stock-reconcile found ${result.soDongLech} mismatched rows`,
        );
      }
      return result;
    });
  }

  private schedule(name: string, cron: string, run: () => Promise<unknown>) {
    const job = CronJob.from({
      cronTime: cron,
      onTick: () => void run(),
      timeZone: this.config.jobsTimezone,
      start: true,
    });
    this.registry.addCronJob(name, job);
    this.names.push(name);
  }
}
