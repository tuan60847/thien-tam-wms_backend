import { Logger } from '@nestjs/common';

const running = new Set<string>();

// Runs `fn` unless the same job is already running in this process, so a slow run is
// never overlapped by the next cron tick. Errors are logged, never thrown into the scheduler.
export async function runExclusive<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  const logger = new Logger(`Job:${name}`);
  if (running.has(name)) {
    logger.warn('skipped: previous run still in progress');
    return undefined;
  }
  running.add(name);
  const startedAt = Date.now();
  try {
    const result = await fn();
    logger.log(`finished in ${Date.now() - startedAt}ms`);
    return result;
  } catch (error) {
    logger.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    return undefined;
  } finally {
    running.delete(name);
  }
}
