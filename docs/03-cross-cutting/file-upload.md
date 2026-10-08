# Tải file lên (lưu trên đĩa máy chủ)

Thuộc milestone **M7**, đã triển khai (module `src/tep-dinh-kem/`). Quyết định lưu trữ: **nội dung file nằm trên đĩa máy chủ, MySQL chỉ lưu đường dẫn tương đối và metadata** (không dùng Cloudinary, không lưu BLOB).

## 1. Dùng để làm gì

| Đối tượng gắn | Nội dung điển hình | Mức nhạy cảm |
|---|---|---|
| `khach_hang` | bản scan GPKD, GCN đủ điều kiện | cao (pháp lý) |
| `nha_cung_cap` | bản scan GPKD, GCN đủ điều kiện, hợp đồng | cao |
| `phieu_nhap_hang` | hóa đơn nhà cung cấp, biên bản nhận hàng | trung bình |
| `so_lo` | phiếu kiểm nghiệm (COA) của lô | trung bình |
| `hang_hoa` | ảnh sản phẩm, tờ hướng dẫn | thấp |

## 2. Mô hình dữ liệu

Bảng `tep_dinh_kem` đa hình (không FK cứng tới từng bảng đích; service kiểm đối tượng tồn tại khi tải lên):

| Trường | Ghi chú |
|---|---|
| `id` | uuid |
| `loaiDoiTuong` (`LoaiDoiTuongTep`) | `khach_hang`, `nha_cung_cap`, `hang_hoa`, `phieu_nhap_hang`, `so_lo` |
| `doiTuongId` | id đối tượng |
| `tenFile` | tên gốc đã làm sạch (≤ 150 ký tự) |
| `mime` | kiểu thật, xác định bằng magic bytes |
| `kichThuoc` | byte |
| `duongDan` | **đường dẫn tương đối** trong `UPLOAD_DIR`, duy nhất, không bao giờ trả ra API |
| `createdById`, `createdAt` | ai, khi nào |

Index: `(loaiDoiTuong, doiTuongId)`. File nằm tại `<UPLOAD_DIR>/<loaiDoiTuong>/<năm>/<uuid>.<đuôi>`; tên trên đĩa do server sinh, không lấy từ client.

## 3. Quy tắc

| Quy tắc | Giá trị |
|---|---|
| Kích thước tối đa | 10 MB mỗi file (vượt → `413 COMMON_PAYLOAD_TOO_LARGE`) |
| Định dạng cho phép | `application/pdf`, `image/jpeg`, `image/png`, `image/webp` |
| Số file tối đa mỗi đối tượng | 20 |
| Tên file | bỏ đường dẫn, ký tự điều khiển, `..`; sửa lỗi mã hóa tên của multer (latin1 → UTF-8) |
| Kiểm tra loại | bằng nội dung (magic bytes), không tin đuôi/`Content-Type`; SVG/HTML bị từ chối |
| Quét mã độc | chưa có ở phase 1 (câu hỏi mở) |

| Mã lỗi | HTTP | Khi nào |
|---|---|---|
| `TEP_NOT_FOUND` | 404 | tệp không tồn tại hoặc file đã mất trên đĩa |
| `TEP_NO_FILE` | 400 | không gửi file hoặc file rỗng |
| `TEP_TYPE_NOT_ALLOWED` | 422 | nội dung không phải PDF/JPEG/PNG/WebP |
| `TEP_TARGET_INVALID` | 422 | đối tượng không tồn tại hoặc đã đủ 20 tệp |
| `TEP_STORAGE_FAILED` | 500 | không ghi được file ra đĩa |
| `AUTH_FORBIDDEN` | 403 | role không được sửa đối tượng gắn |

## 4. Quyền truy cập

- **Đọc / tải về:** mọi role đã đăng nhập (giống quyền đọc chính các đối tượng này). Nội dung được **stream qua API có xác thực**, không có URL công khai; response đặt `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`.
- **Tải lên / xóa:** theo quyền **sửa** đối tượng gắn: `khach_hang`, `nha_cung_cap` → ADMIN, QUAN_LY_KHO, KE_TOAN; `hang_hoa`, `so_lo` → ADMIN, QUAN_LY_KHO; `phieu_nhap_hang` → ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO.
- Xóa tệp ghi `NhatKyHeThong` (`tep_dinh_kem.delete`).

## 5. Endpoint

| Method | Path | Ghi chú |
|---|---|---|
| POST | `/api/v1/tep-dinh-kem` | `multipart/form-data`: `file`, `loaiDoiTuong`, `doiTuongId` |
| GET | `/api/v1/tep-dinh-kem` | lọc `loaiDoiTuong`, `doiTuongId`; phân trang; chỉ trả metadata |
| GET | `/api/v1/tep-dinh-kem/:id/tai-ve` | stream nội dung file |
| DELETE | `/api/v1/tep-dinh-kem/:id` | xóa bản ghi rồi xóa file |

## 6. Vận hành

- `UPLOAD_DIR` (mặc định `./uploads`, đã nằm trong `.gitignore`). Production nên trỏ tới một thư mục ngoài thư mục mã nguồn và **được sao lưu cùng với DB** (DB chỉ giữ đường dẫn: mất thư mục là mất file).
- Ghi file trước, ghi DB sau; nếu ghi DB lỗi thì xóa file vừa ghi (bù trừ). Xóa: DB trước (cùng nhật ký, một giao dịch), file sau; xóa file lỗi chỉ để lại file mồ côi và ghi log `error` (job dọn mồ côi: phase 2).
- Mọi đường dẫn được kiểm tra nằm trong `UPLOAD_DIR` trước khi đọc/xóa.
- Chưa có chống ghi tràn đĩa/quota; theo dõi dung lượng thư mục.

## 7. Kiểm thử

- Unit: magic bytes, làm sạch và giải mã tên, quyền theo loại đối tượng, bù trừ khi ghi DB lỗi, lưu/đọc/xóa và chặn thoát thư mục gốc.
- e2e: tải lên thật vào thư mục tạm (`UPLOAD_DIR` đặt trong test), tải về đúng nội dung và header, file giả `.pdf`, html/svg, quá 10 MB, đủ 20 tệp, quyền theo đối tượng, xóa, file mất trên đĩa.
