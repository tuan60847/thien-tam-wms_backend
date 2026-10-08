# Tech stack

Phiên bản lấy từ `package.json` hiện tại. Cột "Trạng thái": **có** = đã cài; **đề xuất** = chưa cài, sẽ cài khi triển khai milestone tương ứng (kiểm tra tương thích với NestJS 12 lúc cài).

## 1. Đã có

| Thành phần | Phiên bản | Lý do chọn / ghi chú |
|---|---|---|
| Node.js | v24 (máy dev) | LTS mới, hỗ trợ ESM tốt. Phiên bản trên hosting: xem [open-questions.md](../open-questions.md) |
| NestJS (`@nestjs/*`) | ^12.0.1 | Framework chính; module hóa, DI, guard/pipe/filter |
| TypeScript | ^6.0.2 | `strict: true`, `module: nodenext` (ESM — import nội bộ phải có đuôi `.js`) |
| Prisma + `@prisma/client` | ^7.10.0 | ORM có kiểu. **Prisma 7**: datasource URL nằm ở `prisma.config.ts`, kết nối qua driver adapter |
| `@prisma/adapter-mariadb` | ^7.10.0 | Adapter bắt buộc của Prisma 7 để nói chuyện với MySQL |
| MySQL | 8.x (máy dev) | Theo `.env.example`. `Decimal(15,2)` cho tiền |
| `@nestjs/config` | ^12.0.1 | Cấu hình có kiểu (`registerAs`) |
| `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` | ^12 / ^12 / ^4 | Auth |
| `bcrypt` | ^6.0.0 | Băm mật khẩu cost 10 |
| `class-validator`, `class-transformer` | ^0.15.1 / ^0.5.1 | Validate DTO |
| Vitest | ^4.1.2 | Unit + e2e; không cần plugin SWC (đã kiểm chứng decorator metadata hoạt động) |
| `vitest-mock-extended` | ^5.1.1 | Mock có kiểu |
| `supertest` | ^7 | e2e HTTP |
| oxlint (+ type-aware) | ^1.58 | Lint nhanh, `no-floating-promises` bật |
| prettier | ^3.4.2 | Format |
| `@nestjs/observe` | ^0.3.0 | Đang cấu hình bằng key placeholder — cần quyết định giữ hay bỏ ([open-questions.md](../open-questions.md)) |
| `tsx` | ^4.23 | Chạy seed |

## 2. Đề xuất thêm

| Gói | Milestone | Mục đích | Lý do |
|---|---|---|---|
| `nestjs-pino` + `pino-http` (+ `pino-pretty` dev) | M0 | Log JSON có cấu trúc, request-id, redact | Nhanh, chuẩn, dễ gom log trên PM2 |
| `@nestjs/swagger` | M0 | OpenAPI + Swagger UI | Tài liệu API sống, sinh từ DTO |
| `@nestjs/terminus` | M0 | Health check | Chuẩn Nest; check DB |
| `@nestjs/schedule` | M4 | Job nền theo cron | Không cần Redis; đủ cho 1–2 job/ngày |
| `helmet` | M0 | Header bảo mật | Bắt buộc cho API public |
| `@nestjs/throttler` | M1 | Rate limit `/auth/login` | Bù cho giới hạn đã biết của Auth |
| `decimal.js` | — | **Không cần**: dùng `Prisma.Decimal` (đã là decimal.js) | Tránh thêm phụ thuộc |
| `multer` (qua `@nestjs/platform-express`) | M7 | Upload file lên đĩa máy chủ | cấu hình bằng `UPLOAD_DIR` |
| `exceljs` | phase 2 | Xuất báo cáo `.xlsx` | Chỉ khi bạn xác nhận cần |

Không đề xuất: BullMQ/Redis (xem [background-jobs.md](../03-cross-cutting/background-jobs.md)), GraphQL, TypeORM, Passport strategy khác.

## 3. Ràng buộc kỹ thuật cần nhớ

1. **ESM**: mọi import tương đối trong `src/` và `test/` có đuôi `.js`. Import value từ `@prisma/client` ở ESM dùng default/named đúng như `prisma.service.ts` đang làm.
2. **Decorator metadata**: `emitDecoratorMetadata` bật; DTO dùng `class`, không `interface`; `import type` cho thứ chỉ dùng làm kiểu (tránh lỗi `isolatedModules`).
3. **Prisma 7**: sau khi sửa schema chạy `prisma migrate dev` rồi `prisma generate`; client được dựng bằng adapter (xem `PrismaService`).
4. **Decimal**: Prisma trả `Prisma.Decimal`; JSON hóa thành chuỗi (`"125000.00"`). Không bao giờ chuyển sang `number` để tính tiền.
5. **Múi giờ**: DB lưu UTC; nghiệp vụ theo `Asia/Ho_Chi_Minh` (UTC+7). Xem [conventions.md](conventions.md) §ngày giờ.
6. **MySQL CHECK constraint**: Prisma không biểu diễn được; nếu muốn `soLuong >= 0` ở tầng DB phải thêm bằng SQL thô trong migration (xem [migrations-policy.md](../01-data/migrations-policy.md)).
