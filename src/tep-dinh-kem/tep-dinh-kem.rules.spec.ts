import {
  decodeUploadedName,
  detectMime,
  extensionFor,
  sanitizeFileName,
} from './tep-dinh-kem.rules.js';

const bytes = (...values: number[]) => Buffer.from(values);

describe('detectMime (magic bytes)', () => {
  it('nhận đúng PDF, JPEG, PNG, WebP', () => {
    expect(detectMime(Buffer.from('%PDF-1.7\n...'))).toBe('application/pdf');
    expect(detectMime(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe(
      'image/jpeg',
    );
    expect(
      detectMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0)),
    ).toBe('image/png');
    expect(
      detectMime(
        Buffer.concat([
          Buffer.from('RIFF'),
          bytes(0, 0, 0, 0),
          Buffer.from('WEBPVP8 '),
        ]),
      ),
    ).toBe('image/webp');
  });

  it('từ chối nội dung khác dù đuôi/giả loại: exe, html, text, svg, RIFF không phải WebP, rỗng', () => {
    expect(detectMime(Buffer.from('MZ\x90\x00'))).toBeNull();
    expect(
      detectMime(Buffer.from('<html><script>alert(1)</script>')),
    ).toBeNull();
    expect(
      detectMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).toBeNull();
    expect(detectMime(Buffer.from('chỉ là văn bản'))).toBeNull();
    expect(
      detectMime(
        Buffer.concat([
          Buffer.from('RIFF'),
          bytes(0, 0, 0, 0),
          Buffer.from('WAVEfmt '),
        ]),
      ),
    ).toBeNull();
    expect(detectMime(Buffer.alloc(0))).toBeNull();
    expect(detectMime(bytes(0x25, 0x50))).toBeNull(); // truncated "%P"
  });

  it('extensionFor khớp loại', () => {
    expect(extensionFor('application/pdf')).toBe('.pdf');
    expect(extensionFor('image/jpeg')).toBe('.jpg');
  });
});

describe('sanitizeFileName', () => {
  it('giữ tên hợp lệ (kể cả tiếng Việt)', () => {
    expect(
      sanitizeFileName('Giấy phép kinh doanh 2026.pdf', 'application/pdf'),
    ).toBe('Giấy phép kinh doanh 2026.pdf');
  });

  it('bỏ đường dẫn, .. và ký tự điều khiển', () => {
    expect(sanitizeFileName('../../etc/passwd', 'application/pdf')).toBe(
      'passwd',
    );
    expect(sanitizeFileName('C:\\Users\\a\\scan.pdf', 'application/pdf')).toBe(
      'scan.pdf',
    );
    expect(sanitizeFileName('a\u0000b\nc.pdf', 'application/pdf')).toBe(
      'abc.pdf',
    );
    expect(sanitizeFileName('a..b...pdf', 'application/pdf')).toBe('a.b.pdf');
  });

  it('rỗng hoặc chỉ dấu chấm → tên mặc định theo loại; quá dài → cắt, giữ đuôi', () => {
    expect(sanitizeFileName('', 'image/png')).toBe('tep.png');
    expect(sanitizeFileName('   ', 'application/pdf')).toBe('tep.pdf');
    expect(sanitizeFileName('.', 'image/webp')).toBe('tep.webp');
    const long = sanitizeFileName(`${'a'.repeat(300)}.pdf`, 'application/pdf');
    expect(long).toHaveLength(150);
    expect(long.endsWith('.pdf')).toBe(true);
  });
});

describe('decodeUploadedName', () => {
  it('đọc lại tên multer (latin1) thành UTF-8; tên ASCII giữ nguyên', () => {
    const latin1 = Buffer.from('Ảnh GPKD.png', 'utf8').toString('latin1');
    expect(decodeUploadedName(latin1)).toBe('Ảnh GPKD.png');
    expect(decodeUploadedName('scan.pdf')).toBe('scan.pdf');
  });
});
