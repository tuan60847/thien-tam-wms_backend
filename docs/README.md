# ThienTamWMS backend — Tài liệu kế hoạch triển khai

Cập nhật: 2026-10-01. Trạng thái: **bản kế hoạch để review, chưa có code nào được viết theo các tài liệu này** (ngoại trừ module Auth đã làm xong trước đó).

Hệ thống quản lý kho thuốc cho nhà phân phối dược phẩm Thiên Tâm. Backend NestJS 12 (ESM) + Prisma 7 + MySQL.

## Hiện trạng repo (đã xác minh từ code)

- Đã có: khung Nest, `prisma/schema.prisma` (19 model: 18 model nghiệp vụ ban đầu + `RefreshToken`), migration `add_auth`, seed (2 role `ADMIN`, `NHAN_VIEN_KHO` + user `admin`), **module Auth hoàn chỉnh** (login / refresh / logout / me, `JwtAuthGuard` + `RolesGuard` global, `@Public`, `@Roles`, `@CurrentUser`), 31 unit test + 14 e2e test.
- Chưa có: mọi module nghiệp vụ, global prefix `/api/v1`, exception filter, logger, Swagger, health check, pagination chung.
- Lưu ý: `yarn.lock` đang **không** được git theo dõi (đã gỡ khỏi repo) — ảnh hưởng tới CI, xem [05-ops/deployment.md](05-ops/deployment.md).

## Thứ tự đọc đề xuất

1. [00-overview/domain.md](00-overview/domain.md) — nghiệp vụ, actor, thuật ngữ.
2. [00-overview/architecture.md](00-overview/architecture.md), [tech-stack.md](00-overview/tech-stack.md), [conventions.md](00-overview/conventions.md).
3. [00-overview/roadmap.md](00-overview/roadmap.md) — thứ tự triển khai và phụ thuộc.
4. [01-data/](01-data/) — ERD, ghi chú schema, đề xuất thay đổi schema.
5. [03-cross-cutting/](03-cross-cutting/) và [06-api/](06-api/) — "hợp đồng" dùng chung cho mọi module.
6. [02-modules/](02-modules/) — từng module theo thứ tự roadmap.
7. [04-testing/](04-testing/), [05-ops/](05-ops/).
8. [open-questions.md](open-questions.md) — **toàn bộ câu hỏi cần bạn trả lời trước khi code**.

## Mục lục

### 00-overview
| File | Nội dung |
|---|---|
| [domain.md](00-overview/domain.md) | Bối cảnh nghiệp vụ, actor, bảng thuật ngữ VN → EN |
| [architecture.md](00-overview/architecture.md) | Kiến trúc phân lớp, ranh giới module, mối quan tâm xuyên suốt |
| [tech-stack.md](00-overview/tech-stack.md) | Công nghệ, phiên bản, lý do, thư viện đề xuất thêm |
| [conventions.md](00-overview/conventions.md) | Quy ước đặt tên, thư mục, lỗi, log, i18n, đơn vị, tiền, ngày |
| [roadmap.md](00-overview/roadmap.md) | Các milestone M0–M8 và phụ thuộc giữa module |

### 01-data
| File | Nội dung |
|---|---|
| [erd.md](01-data/erd.md) | ERD dạng văn bản + Mermaid, chia theo bounded context |
| [schema-notes.md](01-data/schema-notes.md) | Ghi chú từng trường, bất biến, soft-delete, audit, **tổng hợp đề xuất đổi schema** |
| [seed-strategy.md](01-data/seed-strategy.md) | Seed cho dev / test / staging |
| [migrations-policy.md](01-data/migrations-policy.md) | Cách đặt tên, squash, quy tắc zero-downtime |

### 02-modules (theo thứ tự roadmap)
| File | Milestone |
|---|---|
| [auth.md](02-modules/auth.md) | đã xong (tóm tắt + retrofit M0) |
| [roles.md](02-modules/roles.md), [users.md](02-modules/users.md) | M1 |
| [loai-hang.md](02-modules/loai-hang.md), [hang-hoa.md](02-modules/hang-hoa.md), [ty-le-quy-doi.md](02-modules/ty-le-quy-doi.md) | M2 |
| [kho-vi-tri.md](02-modules/kho-vi-tri.md), [khach-hang.md](02-modules/khach-hang.md), [nha-cung-cap.md](02-modules/nha-cung-cap.md), [phuong-tien-van-chuyen.md](02-modules/phuong-tien-van-chuyen.md) | M3 |
| [so-lo.md](02-modules/so-lo.md), [ton-kho.md](02-modules/ton-kho.md) | M4 |
| [phieu-nhap-hang.md](02-modules/phieu-nhap-hang.md), [phieu-thanh-toan.md](02-modules/phieu-thanh-toan.md) | M5 |
| [phieu-xuat-hang.md](02-modules/phieu-xuat-hang.md), [phieu-thu-cong-no.md](02-modules/phieu-thu-cong-no.md) | M6 |
| [bao-cao.md](02-modules/bao-cao.md) | M7 |

### 03-cross-cutting
[permissions.md](03-cross-cutting/permissions.md) · [validation.md](03-cross-cutting/validation.md) · [error-handling.md](03-cross-cutting/error-handling.md) · [logging.md](03-cross-cutting/logging.md) · [pagination-filtering.md](03-cross-cutting/pagination-filtering.md) · [audit-trail.md](03-cross-cutting/audit-trail.md) · [file-upload.md](03-cross-cutting/file-upload.md) · [background-jobs.md](03-cross-cutting/background-jobs.md)

### 04-testing
[strategy.md](04-testing/strategy.md) · [unit-testing.md](04-testing/unit-testing.md) · [e2e-testing.md](04-testing/e2e-testing.md) · [test-matrix.md](04-testing/test-matrix.md)

### 05-ops
[local-dev.md](05-ops/local-dev.md) · [env-vars.md](05-ops/env-vars.md) · [deployment.md](05-ops/deployment.md) · [observability.md](05-ops/observability.md)

### 06-api
[conventions.md](06-api/conventions.md) · [openapi.md](06-api/openapi.md) · [endpoints-catalog.md](06-api/endpoints-catalog.md)

### Khác
[auth/PLAN.md](auth/PLAN.md) và [auth/README.md](auth/README.md) — tài liệu module Auth đã có (không viết lại).

## Quyết định then chốt đã chốt trong bộ tài liệu này

Các quyết định dưới đây được dùng nhất quán ở mọi file. Nếu bạn muốn đổi, báo để sửa đồng bộ.

| # | Quyết định | Chi tiết ở |
|---|---|---|
| 1 | 4 role cố định: `ADMIN`, `QUAN_LY_KHO`, `NHAN_VIEN_KHO`, `KE_TOAN` | [permissions.md](03-cross-cutting/permissions.md) |
| 2 | Prefix `/api/v1`; success trả resource trần, list trả `{ items, meta }`; lỗi trả body chuẩn có `code` | [06-api/conventions.md](06-api/conventions.md) |
| 3 | Mã lỗi dạng `<DOMAIN>_<REASON>` (UPPER_SNAKE); 400 validate, 404, 409 xung đột/trạng thái, 422 vi phạm quy tắc nghiệp vụ | [error-handling.md](03-cross-cutting/error-handling.md) |
| 4 | Tồn kho lưu theo **đơn vị cơ bản**; dòng chi tiết lưu thêm đơn vị nhập/xuất + hệ số quy đổi | [schema-notes.md](01-data/schema-notes.md) |
| 5 | Phiếu có vòng đời trạng thái; tồn kho chỉ đổi khi chuyển trạng thái xác nhận; phiếu không bị xóa sau khi xác nhận, chỉ hủy | từng module phiếu |
| 6 | Công nợ tính từ phiếu (không lưu số dư); aging tính khi đọc | [phieu-thu-cong-no.md](02-modules/phieu-thu-cong-no.md) |
| 7 | Job nền dùng `@nestjs/schedule` trong tiến trình, chưa dùng BullMQ/Redis | [background-jobs.md](03-cross-cutting/background-jobs.md) |
| 8 | Test unit đặt cạnh file (`*.spec.ts`) như `src/auth`, không dùng thư mục `tests/` | [conventions.md](00-overview/conventions.md) |
