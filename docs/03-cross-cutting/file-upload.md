# Tải file lên (Cloudinary)

Thuộc milestone **M7**, không chặn MVP. `.env.example` đã có `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

## 1. Dùng để làm gì

| Đối tượng gắn | Nội dung điển hình | Mức nhạy cảm |
|---|---|---|
| `khach_hang` | bản scan GPKD, GCN đủ điều kiện | cao (pháp lý) |
| `nha_cung_cap` | bản scan GPKD, GCN đủ điều kiện, hợp đồng | cao |
| `phieu_nhap_hang` | hóa đơn nhà cung cấp, biên bản nhận hàng | trung bình |
| `so_lo` | phiếu kiểm nghiệm (COA) của lô | trung bình |
| `hang_hoa` | ảnh sản phẩm, tờ hướng dẫn | thấp |

Câu hỏi mở: danh sách đối tượng cần đính kèm, và có cần ảnh sản phẩm hay không.

## 2. Mô hình dữ liệu (P-16)

Bảng `TepDinhKem` đa hình (không FK cứng tới từng bảng đích):

| Trường | Ghi chú |
|---|---|
| `id` | uuid |
| `loaiDoiTuong` (`LoaiDoiTuongTep`) | `khach_hang`, `nha_cung_cap`, `hang_hoa`, `phieu_nhap_hang`, `so_lo` |
| `doiTuongId` | id đối tượng (service kiểm tồn tại khi upload) |
| `tenFile` | tên gốc, đã làm sạch |
| `mime` | kiểu thật (kiểm bằng magic bytes, không tin header client) |
| `kichThuoc` | byte |
| `publicId`, `url` | định danh và URL trên Cloudinary |
| `loaiTruyCap` | `private` / `public` (xem §4) |
| `createdById`, `createdAt` | ai, khi nào |

Index: `(loaiDoiTuong, doiTuongId)`.

## 3. Quy tắc

| Quy tắc | Giá trị |
|---|---|
| Kích thước tối đa | 10 MB mỗi file |
| Định dạng cho phép | `application/pdf`, `image/jpeg`, `image/png`, `image/webp` |
| Số file tối đa mỗi đối tượng | 20 |
| Tên file | làm sạch (bỏ ký tự điều khiển, `/`, `..`), giới hạn 150 ký tự |
| Kiểm tra loại | bằng nội dung file (magic bytes), không chỉ đuôi/`Content-Type` |
| Quét mã độc | chưa có ở phase 1 (câu hỏi mở) |

Vi phạm → `TEP_TOO_LARGE` / `TEP_TYPE_NOT_ALLOWED` (422). Cloudinary lỗi → `TEP_UPLOAD_FAILED` (502), không lộ chi tiết nhà cung cấp.

## 4. Quyền truy cập file

- File nhạy cảm (giấy phép, hợp đồng) lưu với `type: 'authenticated'` trên Cloudinary; API trả **URL ký có hạn ngắn** (ví dụ 5 phút) sinh theo yêu cầu qua `GET /api/v1/tep-dinh-kem/:id/url`, chỉ cho user có quyền xem đối tượng gắn.
- Ảnh sản phẩm không nhạy cảm có thể `public`.
- Không bao giờ ghi URL ký vào DB hay log.
- Quyền: upload / xóa theo quyền **sửa** đối tượng gắn; xem theo quyền **đọc** đối tượng gắn ([permissions.md](permissions.md) §3.7).

## 5. Endpoint

| Method | Path | Ghi chú |
|---|---|---|
| POST | `/api/v1/tep-dinh-kem` | `multipart/form-data`: `file`, `loaiDoiTuong`, `doiTuongId` |
| GET | `/api/v1/tep-dinh-kem` | lọc `loaiDoiTuong`, `doiTuongId`; danh sách metadata |
| GET | `/api/v1/tep-dinh-kem/:id/url` | trả `{ url, expiresAt }` |
| DELETE | `/api/v1/tep-dinh-kem/:id` | xóa DB + xóa trên Cloudinary |

(Module `tep-dinh-kem` chưa có doc riêng trong `02-modules/`: là hạ tầng dùng chung, chốt ở đây và ở [endpoints-catalog.md](../06-api/endpoints-catalog.md).)

## 6. Cài đặt (đề xuất)

- Gói: `cloudinary`, `@nestjs/platform-express` (đã có, có `FileInterceptor`), `multer` (`@types/multer`).
- `FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })`.
- `CloudinaryService.upload(buffer, { folder, resourceType: 'auto', type })` dùng `upload_stream`; `folder` = `thientam-wms/<env>/<loaiDoiTuong>`.
- `TepDinhKemService`: kiểm tra đối tượng tồn tại và quyền, kiểm tra magic bytes, upload, ghi DB. Nếu ghi DB lỗi sau khi upload → xóa file trên Cloudinary (bù trừ); nếu xóa Cloudinary lỗi → log `error` và để job dọn file mồ côi (phase 2).
- Cấu hình qua `@nestjs/config` (`cloudinary.config.ts`); thiếu biến thì module upload tắt và endpoint trả `503` thay vì làm app không khởi động (chỉ ở môi trường không cấu hình Cloudinary).

## 7. Kiểm thử

- Unit: kiểm kích thước/loại/magic bytes; làm sạch tên file; bù trừ khi ghi DB lỗi (mock Cloudinary).
- e2e: Cloudinary **mock** (thay `CloudinaryService` bằng stub in-memory) — không gọi mạng thật; kiểm upload hợp lệ, file quá lớn, sai loại, đối tượng không tồn tại, quyền (role không có quyền sửa đối tượng → 403), URL ký chỉ cấp cho người được xem.
