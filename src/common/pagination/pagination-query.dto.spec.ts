import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto.js';

async function check(query: Record<string, string | undefined>) {
  const dto = plainToInstance(PaginationQueryDto, query);
  return { dto, errors: await validate(dto) };
}

describe('PaginationQueryDto', () => {
  it('mặc định page=1, pageSize=20', async () => {
    const { dto, errors } = await check({});
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(20);
  });

  it('ép chuỗi query thành số', async () => {
    const { dto, errors } = await check({ page: '3', pageSize: '50' });
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(3);
    expect(dto.pageSize).toBe(50);
  });

  it.each([
    { page: '0' },
    { page: '-1' },
    { page: 'abc' },
    { pageSize: '101' },
    { pageSize: '0' },
    { pageSize: '1.5' },
  ])('từ chối %j', async (query) => {
    const { errors } = await check(query);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('pageSize=100 là hợp lệ', async () => {
    expect((await check({ pageSize: '100' })).errors).toHaveLength(0);
  });
});
