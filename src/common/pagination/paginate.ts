import { AppException } from '../errors/app.exception.js';
import { vnDayRangeUtc } from '../clock/vn-date.js';
import { MAX_PAGE_SIZE } from './pagination-query.dto.js';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PagedResponse<T> {
  items: T[];
  meta: PageMeta;
}

export function buildMeta(
  page: number,
  pageSize: number,
  total: number,
): PageMeta {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export function toSkipTake(
  page: number,
  pageSize: number,
): { skip: number; take: number } {
  const size = Math.min(pageSize, MAX_PAGE_SIZE);
  return { skip: (page - 1) * size, take: size };
}

// Runs the page query and the count in parallel and shapes the response.
export async function paginate<TRow, TItem = TRow>(options: {
  page: number;
  pageSize: number;
  findMany: (args: { skip: number; take: number }) => Promise<TRow[]>;
  count: () => Promise<number>;
  map?: (row: TRow) => TItem;
}): Promise<PagedResponse<TItem>> {
  const { skip, take } = toSkipTake(options.page, options.pageSize);
  const [rows, total] = await Promise.all([
    options.findMany({ skip, take }),
    options.count(),
  ]);
  const items = options.map
    ? rows.map(options.map)
    : (rows as unknown as TItem[]);
  return { items, meta: buildMeta(options.page, take, total) };
}

export type SortDirection = 'asc' | 'desc';
export interface SortSpec {
  field: string;
  direction: SortDirection;
}

// Parses "a:asc,b:desc" against a whitelist. Unknown fields -> VALIDATION_FAILED.
export function parseSort(
  sort: string | undefined,
  whitelist: readonly string[],
  fallback: SortSpec[],
): SortSpec[] {
  if (!sort?.trim()) {
    return fallback;
  }
  const specs: SortSpec[] = [];
  for (const part of sort.split(',')) {
    const [rawField, rawDirection = 'asc'] = part.trim().split(':');
    const field = rawField?.trim();
    const direction = rawDirection.trim().toLowerCase();
    if (
      !field ||
      !whitelist.includes(field) ||
      (direction !== 'asc' && direction !== 'desc')
    ) {
      throw new AppException('VALIDATION_FAILED', {
        details: [
          {
            field: 'sort',
            messages: [`Không được sắp xếp theo "${part.trim()}"`],
          },
        ],
      });
    }
    specs.push({ field, direction });
  }
  return specs;
}

// Prisma orderBy from sort specs; always appends id for stable paging.
// `resolvers` maps a sort field to a nested shape, e.g.
// { tenSP: (d) => ({ hangHoa: { tenSP: d } }) }.
export function toOrderBy(
  specs: SortSpec[],
  resolvers: Record<
    string,
    (direction: SortDirection) => Record<string, unknown>
  > = {},
): Record<string, unknown>[] {
  const orderBy = specs.map(({ field, direction }) =>
    resolvers[field] ? resolvers[field](direction) : { [field]: direction },
  );
  orderBy.push({ id: 'asc' });
  return orderBy;
}

// Inclusive VN-calendar date range -> { gte, lt } UTC instants.
export function dateRangeFilter(
  from: string | undefined,
  to: string | undefined,
): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) {
    return undefined;
  }
  if (from && to && from > to) {
    throw new AppException('VALIDATION_FAILED', {
      details: [
        {
          field: 'from',
          messages: ['Ngày bắt đầu phải trước hoặc bằng ngày kết thúc'],
        },
      ],
    });
  }
  const filter: { gte?: Date; lt?: Date } = {};
  if (from) {
    filter.gte = vnDayRangeUtc(from, from).start;
  }
  if (to) {
    filter.lt = vnDayRangeUtc(to, to).endExclusive;
  }
  return filter;
}
