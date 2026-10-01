# Kiến trúc

## 1. Tổng quan

Monolith module hóa (NestJS), một tiến trình HTTP, một database MySQL. Mỗi bounded context là một Nest module; module giao tiếp qua **service được export**, **chỉ ghi bảng của mình**; việc ghi vào bảng của module khác luôn đi qua service của chủ sở hữu. Đọc qua relation Prisma (ví dụ `so-lo` lọc theo `tonKhos`) và các truy vấn tổng hợp trong `bao-cao` được phép.

```
HTTP request
   │
   ▼
Global middleware: request-id, logger
   │
   ▼
Global guards: JwtAuthGuard → RolesGuard            (đã có, module auth)
   │
   ▼
Global pipe: ValidationPipe (whitelist, forbidNonWhitelisted, transform)
   │
   ▼
Controller      ← chỉ: DTO → gọi service → trả response DTO
   │
   ▼
Service         ← nghiệp vụ, transaction, kiểm tra business rule
   │
   ▼
PrismaService   ← truy cập dữ liệu (không có repository layer riêng)
   │
   ▼
MySQL

Global exception filter  ← mọi lỗi → body lỗi chuẩn
Global interceptor       ← log thời gian xử lý, serialize Decimal → string
```

## 2. Phân lớp và trách nhiệm

| Lớp | Được làm | Không được làm |
|---|---|---|
| Controller | Khai báo route, guard/decorator, bind DTO, map kết quả sang response DTO | Logic nghiệp vụ, gọi Prisma, mở transaction |
| Service | Business rule, transaction, ném lỗi nghiệp vụ có `code`, gọi service khác | Đọc `request`, biết HTTP status |
| Prisma | Truy vấn | Chứa logic |
| DTO | Hình dạng + validation cú pháp | Quy tắc cần truy vấn DB |
| Mapper (hàm thuần) | Prisma entity → response DTO (che field nhạy cảm, đổi Decimal sang string) | Truy vấn |

Không thêm repository layer: Prisma đã là lớp truy cập dữ liệu có kiểu; thêm một lớp nữa chỉ tăng boilerplate. Nếu một truy vấn phức tạp được dùng ở nhiều nơi, đặt thành method private/public của service sở hữu bảng đó.

## 3. Ranh giới module và phụ thuộc

Quy tắc: **mỗi bảng có đúng một module sở hữu**; chỉ module đó ghi vào bảng. Module khác muốn ghi phải gọi service của chủ sở hữu.

| Module (thư mục `src/`) | Sở hữu bảng | Export service cho |
|---|---|---|
| `auth` | `RefreshToken` | tất cả (guard, decorator) |
| `users` | `User` | `auth`, `audit` |
| `roles` | `Role` | `users` |
| `loai-hang` | `LoaiHang` | `hang-hoa` |
| `hang-hoa` | `HangHoa` | `ty-le-quy-doi`, `so-lo`, phiếu |
| `ty-le-quy-doi` | `TyLeQuyDoi` | `hang-hoa`, phiếu (đổi đơn vị) |
| `kho-vi-tri` | `Kho`, `ViTri` | `ton-kho`, phiếu nhập |
| `so-lo` | `SoLo` | `ton-kho`, phiếu |
| `ton-kho` | `TonKho`, `BienDongTonKho` (đề xuất) | phiếu nhập/xuất (tăng/giảm tồn) |
| `khach-hang` | `KhachHang` | `phieu-xuat-hang`, `phieu-thu-cong-no` |
| `nha-cung-cap` | `NhaCungCap` | `phieu-nhap-hang`, `phieu-thanh-toan` |
| `phuong-tien-van-chuyen` | `PhuongTienVanChuyen` | phiếu |
| `phieu-nhap-hang` | `PhieuNhapHang`, `ChiTietPhieuNhapHang` | `phieu-thanh-toan`, `bao-cao` |
| `phieu-xuat-hang` | `PhieuXuatHang`, `ChiTietPhieuXuatHang` | `phieu-thu-cong-no`, `bao-cao` |
| `phieu-thu-cong-no` | `PhieuThuCongNo` | `bao-cao` |
| `phieu-thanh-toan` | `PhieuThanhToan` | `bao-cao` |
| `bao-cao` | — (chỉ đọc) | — |
| `common` (hạ tầng) | `BoDemMa` (đề xuất) | sinh mã phiếu |
| `audit` (hạ tầng) | `NhatKyHeThong` (đề xuất) | ghi nhật ký |
| `tep-dinh-kem` (hạ tầng, M7) | `TepDinhKem` (đề xuất) | các module có file |

Đồ thị phụ thuộc (mũi tên = "cần"):

```
roles ◄── users ◄── auth
loai-hang ◄── hang-hoa ◄── ty-le-quy-doi
hang-hoa ◄── so-lo ◄── ton-kho ──► kho-vi-tri
phieu-nhap-hang ──► nha-cung-cap, so-lo, ton-kho, kho-vi-tri, ty-le-quy-doi, phuong-tien-van-chuyen
phieu-xuat-hang ──► khach-hang, so-lo, ton-kho, ty-le-quy-doi
phieu-thanh-toan ──► phieu-nhap-hang
phieu-thu-cong-no ──► phieu-xuat-hang
bao-cao ──► (đọc) tất cả
```

Không có phụ thuộc vòng: `phieu-*` phụ thuộc `ton-kho`, không có chiều ngược lại. Nếu `ton-kho` cần biết "phiếu nào gây ra biến động", nó nhận `loaiThamChieu` + `thamChieuId` dạng chuỗi/uuid chứ không import module phiếu.

## 4. Transaction và đồng thời

- Mọi nghiệp vụ làm thay đổi **nhiều bảng** (xác nhận phiếu nhập, xuất kho, hủy phiếu, điều chỉnh tồn, chuyển vị trí) chạy trong **một** `prisma.$transaction(async (tx) => …)`.
- Service của module khác được gọi bên trong transaction nhận `tx` làm tham số (kiểu `Prisma.TransactionClient`) thay vì tự mở transaction mới. Quy ước: tham số cuối `tx?: Prisma.TransactionClient`; mặc định dùng `this.prisma`.
- **Giảm tồn dùng cập nhật có điều kiện** (atomic): `updateMany({ where: { id, soLuong: { gte: n } }, data: { soLuong: { decrement: n } } })` rồi kiểm tra `count === 1`. Không đọc-rồi-ghi. Hai request xuất song song cùng một dòng tồn thì một cái thất bại với `TON_KHO_INSUFFICIENT`.
- Chuyển trạng thái phiếu dùng cùng kỹ thuật: `updateMany({ where: { id, trangThai: <trạng thái cũ> }, data: { trangThai: <mới> } })` — tránh hai người bấm "xác nhận" cùng lúc.
- Mức cô lập mặc định của MySQL (REPEATABLE READ) là đủ khi dùng cập nhật có điều kiện; không cần `SELECT … FOR UPDATE`.
- Sinh mã phiếu trong cùng transaction với việc tạo phiếu (bảng `BoDemMa`, `UPDATE … SET gia_tri = gia_tri + 1` rồi đọc lại) — xem [conventions.md](conventions.md).

## 5. Mối quan tâm xuyên suốt (cross-cutting)

| Mối quan tâm | Cơ chế | Tài liệu |
|---|---|---|
| Xác thực / phân quyền | `JwtAuthGuard` + `RolesGuard` global, `@Public`, `@Roles` | [auth.md](../02-modules/auth.md), [permissions.md](../03-cross-cutting/permissions.md) |
| Validation | `ValidationPipe` global + DTO `class-validator` + kiểm tra nghiệp vụ trong service | [validation.md](../03-cross-cutting/validation.md) |
| Lỗi | `HttpExceptionFilter` global, `AppException` có `code` | [error-handling.md](../03-cross-cutting/error-handling.md) |
| Log | `nestjs-pino`, request-id, che dữ liệu nhạy cảm | [logging.md](../03-cross-cutting/logging.md) |
| Phân trang / lọc / sắp xếp | `PaginationQueryDto` + helper | [pagination-filtering.md](../03-cross-cutting/pagination-filtering.md) |
| Audit | `createdById`/`updatedById`, `NhatKyHeThong`, `BienDongTonKho` | [audit-trail.md](../03-cross-cutting/audit-trail.md) |
| File | Cloudinary qua `tep-dinh-kem` | [file-upload.md](../03-cross-cutting/file-upload.md) |
| Job nền | `@nestjs/schedule` | [background-jobs.md](../03-cross-cutting/background-jobs.md) |
| Cấu hình | `@nestjs/config`, validate khi khởi động | [env-vars.md](../05-ops/env-vars.md) |
| Quan sát | health check, request log | [observability.md](../05-ops/observability.md) |

## 6. Cấu trúc thư mục tổng thể (đích)

```
src/
  main.ts
  app.module.ts
  common/                 # hạ tầng dùng chung, không chứa nghiệp vụ
    errors/               # AppException, error-codes.ts, http-exception.filter.ts
    pagination/           # PaginationQueryDto, paginate(), PagedResponse<T>
    decimal/              # helper tính tiền với Prisma.Decimal
    code-generator/       # BoDemMa + CodeGeneratorService
    interceptors/
    decorators/
  config/                 # *.config.ts (đã có auth.config.ts)
  prisma/                 # đã có
  auth/ users/ roles/     # M1 (auth đã có)
  loai-hang/ hang-hoa/ ty-le-quy-doi/
  kho-vi-tri/ khach-hang/ nha-cung-cap/ phuong-tien-van-chuyen/
  so-lo/ ton-kho/
  phieu-nhap-hang/ phieu-thanh-toan/
  phieu-xuat-hang/ phieu-thu-cong-no/
  bao-cao/
  audit/
  tep-dinh-kem/
  health/
test/
  *.e2e-spec.ts
  helpers/ fixtures/
```

## 7. Những thứ cố ý KHÔNG làm ở phase 1

- Không microservice, không message broker, không CQRS/event sourcing.
- Không cache tầng ứng dụng (Redis) — chưa có bằng chứng cần; báo cáo đọc thẳng DB.
- Không multi-tenant: một công ty, một database.
- Không multi-warehouse routing tự động: người dùng chọn vị trí.
