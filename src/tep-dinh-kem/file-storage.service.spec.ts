import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStorageService } from './file-storage.service.js';

describe('FileStorageService', () => {
  let dir: string;
  let storage: FileStorageService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'wms-storage-'));
    storage = new FileStorageService({ uploadDir: dir } as never);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('lưu file vào <thư mục>/<loại>/<năm>/<uuid><đuôi> và trả đường dẫn tương đối', async () => {
    const relative = await storage.save(
      'khach_hang',
      '.pdf',
      Buffer.from('%PDF-x'),
    );
    expect(relative).toMatch(/^khach_hang\/\d{4}\/[0-9a-f-]{36}\.pdf$/);
    expect(await readFile(join(dir, relative), 'utf8')).toBe('%PDF-x');
  });

  it('mỗi lần lưu ra một đường dẫn khác nhau (không ghi đè)', async () => {
    const a = await storage.save('so_lo', '.png', Buffer.from('1'));
    const b = await storage.save('so_lo', '.png', Buffer.from('2'));
    expect(a).not.toBe(b);
  });

  it('open đọc lại được; file mất trên đĩa → null', async () => {
    const relative = await storage.save(
      'so_lo',
      '.pdf',
      Buffer.from('%PDF-abc'),
    );
    const stream = await storage.open(relative);
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe('%PDF-abc');
    await storage.remove(relative);
    expect(existsSync(join(dir, relative))).toBe(false);
    await expect(storage.open(relative)).resolves.toBeNull();
  });

  it('remove file không tồn tại không lỗi', async () => {
    await expect(
      storage.remove('so_lo/2026/none.pdf'),
    ).resolves.toBeUndefined();
  });

  it('đường dẫn thoát khỏi thư mục gốc bị từ chối (open/remove)', async () => {
    await expect(storage.open('../../etc/passwd')).rejects.toThrow('escapes');
    await expect(storage.remove('../outside.pdf')).rejects.toThrow('escapes');
    await expect(storage.open('/etc/passwd')).rejects.toThrow('escapes');
  });
});
