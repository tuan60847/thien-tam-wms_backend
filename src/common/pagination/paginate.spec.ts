import {
  buildMeta,
  dateRangeFilter,
  paginate,
  parseSort,
  toOrderBy,
  toSkipTake,
} from './paginate.js';

const WHITELIST = ['hanSuDung', 'tenLo'] as const;
const FALLBACK = [{ field: 'hanSuDung', direction: 'asc' as const }];

describe('buildMeta', () => {
  it.each([
    [1, 20, 0, 0],
    [1, 20, 20, 1],
    [1, 20, 21, 2],
    [3, 10, 134, 14],
  ])('page %i size %i total %i → totalPages %i', (page, size, total, pages) => {
    expect(buildMeta(page, size, total)).toEqual({
      page,
      pageSize: size,
      total,
      totalPages: pages,
    });
  });
});

describe('toSkipTake', () => {
  it('tính skip theo trang', () => {
    expect(toSkipTake(3, 20)).toEqual({ skip: 40, take: 20 });
  });

  it('không cho vượt pageSize tối đa', () => {
    expect(toSkipTake(1, 500).take).toBe(100);
  });
});

describe('parseSort', () => {
  it('dùng mặc định khi không truyền sort', () => {
    expect(parseSort(undefined, WHITELIST, FALLBACK)).toEqual(FALLBACK);
    expect(parseSort('  ', WHITELIST, FALLBACK)).toEqual(FALLBACK);
  });

  it('đọc nhiều field và hướng, mặc định asc', () => {
    expect(parseSort('hanSuDung:desc,tenLo', WHITELIST, FALLBACK)).toEqual([
      { field: 'hanSuDung', direction: 'desc' },
      { field: 'tenLo', direction: 'asc' },
    ]);
  });

  it.each(['password:asc', 'tenLo:up', ':asc', 'hanSuDung:asc,x:asc'])(
    'từ chối "%s" bằng VALIDATION_FAILED',
    (sort) => {
      expect(() => parseSort(sort, WHITELIST, FALLBACK)).toThrow(
        expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      );
    },
  );
});

describe('toOrderBy', () => {
  it('luôn thêm id làm khóa phụ cuối để thứ tự ổn định giữa các trang', () => {
    expect(toOrderBy([{ field: 'tenLo', direction: 'desc' }])).toEqual([
      { tenLo: 'desc' },
      { id: 'asc' },
    ]);
  });

  it('hỗ trợ field lồng nhau qua resolver', () => {
    expect(
      toOrderBy([{ field: 'tenSP', direction: 'asc' }], {
        tenSP: (d) => ({ hangHoa: { tenSP: d } }),
      }),
    ).toEqual([{ hangHoa: { tenSP: 'asc' } }, { id: 'asc' }]);
  });
});

describe('dateRangeFilter', () => {
  it('không truyền gì → undefined', () => {
    expect(dateRangeFilter(undefined, undefined)).toBeUndefined();
  });

  it('bao gồm cả hai đầu theo giờ VN', () => {
    const filter = dateRangeFilter('2026-10-01', '2026-10-02');
    expect(filter?.gte?.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(filter?.lt?.toISOString()).toBe('2026-10-02T17:00:00.000Z');
  });

  it('chỉ có một đầu', () => {
    expect(dateRangeFilter('2026-10-01', undefined)).toEqual({
      gte: new Date('2026-09-30T17:00:00.000Z'),
    });
    expect(dateRangeFilter(undefined, '2026-10-01')).toEqual({
      lt: new Date('2026-10-01T17:00:00.000Z'),
    });
  });

  it('from sau to → VALIDATION_FAILED', () => {
    expect(() => dateRangeFilter('2026-10-02', '2026-10-01')).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    );
  });
});

describe('paginate', () => {
  it('truyền skip/take đúng, trả items + meta, map từng dòng', async () => {
    const findMany = vi.fn().mockResolvedValue([1, 2]);
    const result = await paginate({
      page: 2,
      pageSize: 2,
      findMany,
      count: async () => 5,
      map: (n: number) => `#${n}`,
    });
    expect(findMany).toHaveBeenCalledWith({ skip: 2, take: 2 });
    expect(result).toEqual({
      items: ['#1', '#2'],
      meta: { page: 2, pageSize: 2, total: 5, totalPages: 3 },
    });
  });

  it('trang vượt giới hạn → items rỗng, meta đúng, không lỗi', async () => {
    const result = await paginate({
      page: 99,
      pageSize: 20,
      findMany: async () => [],
      count: async () => 3,
    });
    expect(result.items).toEqual([]);
    expect(result.meta.totalPages).toBe(1);
  });
});
