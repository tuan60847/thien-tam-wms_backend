import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  bearer,
  createHangHoa,
  createLoaiHang,
  loginAll,
  type Tokens,
} from './helpers/catalog.js';
import { createTestApp } from './helpers/create-app.js';
import { vnDate } from './helpers/dates.js';
import { migrateTestDatabase, resetAndSeed } from './helpers/test-db.js';

interface Id {
  id: string;
}
interface FileBody {
  id: string;
  tenFile: string;
  mime: string;
  kichThuoc: number;
  duongDan?: unknown;
}
interface Page<T> {
  items: T[];
  meta: { total: number };
}
interface ErrorBody {
  code: string;
}

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200, 'x')]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);

describe('Tệp đính kèm (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Tokens;
  let uploadDir: string;
  const http = () => request(app.getHttpServer());
  const as = (user: string) => bearer(tokens, user);

  let khachId: string;
  let hangId: string;

  const upload = (
    user: string,
    loaiDoiTuong: string,
    doiTuongId: string,
    content: Buffer | null = PDF,
    filename = 'giay-phep.pdf',
    contentType = 'application/pdf',
  ) => {
    const req = http()
      .post('/api/v1/tep-dinh-kem')
      .set(as(user))
      .field('loaiDoiTuong', loaiDoiTuong)
      .field('doiTuongId', doiTuongId);
    return content
      ? req.attach('file', content, { filename, contentType })
      : req;
  };
  const filesOnDisk = async (): Promise<string[]> => {
    const found: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await walk(path);
        else found.push(path);
      }
    };
    if (existsSync(uploadDir)) await walk(uploadDir);
    return found;
  };

  beforeAll(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'wms-e2e-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    migrateTestDatabase();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetAndSeed(prisma);
    tokens = await loginAll(app, ['admin', 'quanly', 'kho', 'ketoan']);

    khachId = (
      await http()
        .post('/api/v1/khach-hang')
        .set(as('ketoan'))
        .send({ tenKH: 'Nhà thuốc A', ngayHetHanGPKD: vnDate(400) })
        .expect(201)
    ).body.id as string;
    const loai = await createLoaiHang(app, tokens, 'Thuốc');
    hangId = (await createHangHoa(app, tokens, loai.id)).id;
  });

  afterAll(async () => {
    await app.close();
    delete process.env.UPLOAD_DIR;
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('tải lên PDF: lưu file trên đĩa, DB chỉ giữ metadata, response không lộ đường dẫn', async () => {
    const res = await upload('ketoan', 'khach_hang', khachId).expect(201);
    const body = res.body as FileBody;
    expect(body).toMatchObject({
      tenFile: 'giay-phep.pdf',
      mime: 'application/pdf',
      kichThuoc: PDF.length,
    });
    expect(body.duongDan).toBeUndefined();
    const row = await prisma.tepDinhKem.findUniqueOrThrow({
      where: { id: body.id },
    });
    expect(row.duongDan).toMatch(/^khach_hang\/\d{4}\/[0-9a-f-]{36}\.pdf$/);
    expect(existsSync(join(uploadDir, row.duongDan))).toBe(true);
  });

  it('tải về đúng nội dung, đúng header; mọi role đã đăng nhập đọc được, không token → 401', async () => {
    const id = (
      (
        await upload(
          'admin',
          'khach_hang',
          khachId,
          PNG,
          'Ảnh GPKD.png',
          'image/png',
        ).expect(201)
      ).body as FileBody
    ).id;
    const res = await http()
      .get(`/api/v1/tep-dinh-kem/${id}/tai-ve`)
      .set(as('kho'))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(Buffer.from(res.body as Buffer).equals(PNG)).toBe(true);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(
      decodeURIComponent(res.headers['content-disposition'] as string),
    ).toContain('Ảnh GPKD.png');
    await http().get(`/api/v1/tep-dinh-kem/${id}/tai-ve`).expect(401);
    await http()
      .get('/api/v1/tep-dinh-kem/not-a-uuid/tai-ve')
      .set(as('kho'))
      .expect(400);
    await http()
      .get('/api/v1/tep-dinh-kem/00000000-0000-4000-8000-000000000000/tai-ve')
      .set(as('kho'))
      .expect(404);
  });

  it('loại thật theo nội dung, không tin tên/Content-Type: .pdf giả, html, svg → 422; không gửi file → 400', async () => {
    const fake = await upload(
      'admin',
      'khach_hang',
      khachId,
      Buffer.from('MZ not a pdf'),
      'x.pdf',
      'application/pdf',
    );
    expect(fake.status).toBe(422);
    expect((fake.body as ErrorBody).code).toBe('TEP_TYPE_NOT_ALLOWED');
    for (const [name, content, type] of [
      ['a.html', '<html><script>1</script>', 'text/html'],
      ['a.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml'],
    ] as const) {
      expect(
        (
          await upload(
            'admin',
            'khach_hang',
            khachId,
            Buffer.from(content),
            name,
            type,
          )
        ).status,
      ).toBe(422);
    }
    const none = await upload('admin', 'khach_hang', khachId, null);
    expect(none.status).toBe(400);
    expect((none.body as ErrorBody).code).toBe('TEP_NO_FILE');
  });

  it('quá 10 MB → 413 và không để lại file', async () => {
    const before = (await filesOnDisk()).length;
    const big = Buffer.concat([
      Buffer.from('%PDF-'),
      Buffer.alloc(10 * 1024 * 1024 + 10),
    ]);
    const res = await upload('admin', 'khach_hang', khachId, big);
    expect(res.status).toBe(413);
    expect((await filesOnDisk()).length).toBe(before);
  });

  it('đối tượng không tồn tại → 422; thiếu hoặc sai trường → 400', async () => {
    const missing = await upload(
      'admin',
      'khach_hang',
      '00000000-0000-4000-8000-000000000000',
    );
    expect(missing.status).toBe(422);
    expect((missing.body as ErrorBody).code).toBe('TEP_TARGET_INVALID');
    expect((await upload('admin', 'xe_tai', khachId)).status).toBe(400);
    expect((await upload('admin', 'khach_hang', 'abc')).status).toBe(400);
  });

  it('tối đa 20 tệp mỗi đối tượng', async () => {
    const target = (
      await http()
        .post('/api/v1/khach-hang')
        .set(as('ketoan'))
        .send({ tenKH: 'Đủ 20', ngayHetHanGPKD: vnDate(400) })
        .expect(201)
    ).body as Id;
    for (let i = 0; i < 20; i++) {
      await upload('ketoan', 'khach_hang', target.id, PDF, `f${i}.pdf`).expect(
        201,
      );
    }
    const over = await upload('ketoan', 'khach_hang', target.id);
    expect(over.status).toBe(422);
    expect((over.body as ErrorBody).code).toBe('TEP_TARGET_INVALID');
  });

  it('quyền ghi theo đối tượng gắn: NVK không đính kèm khách hàng/hàng hóa, kế toán không đính kèm hàng hóa', async () => {
    expect((await upload('kho', 'khach_hang', khachId)).status).toBe(403);
    expect((await upload('kho', 'hang_hoa', hangId)).status).toBe(403);
    expect((await upload('ketoan', 'hang_hoa', hangId)).status).toBe(403);
    expect((await upload('quanly', 'hang_hoa', hangId)).status).toBe(201);
    expect(
      (await upload('admin', 'so_lo', '00000000-0000-4000-8000-000000000000'))
        .status,
    ).toBe(422);
  });

  it('danh sách lọc theo đối tượng, chỉ trả metadata', async () => {
    const res = await http()
      .get(`/api/v1/tep-dinh-kem?loaiDoiTuong=hang_hoa&doiTuongId=${hangId}`)
      .set(as('kho'))
      .expect(200);
    const page = res.body as Page<FileBody>;
    expect(page.meta.total).toBeGreaterThanOrEqual(1);
    expect(page.items.every((f) => f.duongDan === undefined)).toBe(true);
    await http()
      .get('/api/v1/tep-dinh-kem?loaiDoiTuong=xe')
      .set(as('kho'))
      .expect(400);
    await http()
      .get('/api/v1/tep-dinh-kem?sort=duongDan:asc')
      .set(as('kho'))
      .expect(400);
  });

  it('xóa: bản ghi và file biến mất, có nhật ký; NVK không xóa được tệp của khách hàng', async () => {
    const created = (
      await upload('ketoan', 'khach_hang', khachId, PDF, 'xoa.pdf').expect(201)
    ).body as FileBody;
    const row = await prisma.tepDinhKem.findUniqueOrThrow({
      where: { id: created.id },
    });
    await http()
      .delete(`/api/v1/tep-dinh-kem/${created.id}`)
      .set(as('kho'))
      .expect(403);
    expect(existsSync(join(uploadDir, row.duongDan))).toBe(true);

    await http()
      .delete(`/api/v1/tep-dinh-kem/${created.id}`)
      .set(as('ketoan'))
      .expect(204);
    expect(existsSync(join(uploadDir, row.duongDan))).toBe(false);
    expect(await prisma.tepDinhKem.count({ where: { id: created.id } })).toBe(
      0,
    );
    expect(
      await prisma.nhatKyHeThong.count({
        where: { hanhDong: 'tep_dinh_kem.delete', doiTuongId: created.id },
      }),
    ).toBe(1);
    await http()
      .delete(`/api/v1/tep-dinh-kem/${created.id}`)
      .set(as('ketoan'))
      .expect(404);
    await http()
      .get(`/api/v1/tep-dinh-kem/${created.id}/tai-ve`)
      .set(as('ketoan'))
      .expect(404);
  });

  it('file bị mất trên đĩa → tải về 404, không lộ đường dẫn', async () => {
    const created = (
      await upload('admin', 'khach_hang', khachId, PDF, 'mat.pdf').expect(201)
    ).body as FileBody;
    const row = await prisma.tepDinhKem.findUniqueOrThrow({
      where: { id: created.id },
    });
    await rm(join(uploadDir, row.duongDan));
    const res = await http()
      .get(`/api/v1/tep-dinh-kem/${created.id}/tai-ve`)
      .set(as('admin'));
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(row.duongDan);
  });
});
