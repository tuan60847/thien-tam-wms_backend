# Audit trail

Ba cơ chế bổ sung nhau, mỗi cái trả lời một câu hỏi khác nhau:

| Cơ chế | Trả lời | Phạm vi |
|---|---|---|
| Trường audit trên bảng (`createdAt/updatedAt/createdById/updatedById`) | "Ai tạo / sửa gần nhất, khi nào?" | mọi bảng nghiệp vụ |
| `BienDongTonKho` (sổ biến động tồn) | "Vì sao tồn của lô X ở vị trí Y thay đổi?" | chỉ tồn kho |
| `NhatKyHeThong` (nhật ký thao tác) | "Ai đã làm thao tác nhạy cảm gì, giá trị trước/sau?" | một danh sách thao tác chọn lọc |

## 1. Trường audit trên bảng (P-02)

Xem danh sách trường ở [schema-notes.md](../01-data/schema-notes.md) §3.

- `createdById` / `updatedById`: service gán từ `AuthenticatedUser.id`; không nhận từ client (DTO `whitelist` loại bỏ).
- `updatedAt` do Prisma (`@updatedAt`).
- Response không trả `createdById`/`updatedById` thô mà trả `createdBy: { id, maNV, hoTen }` (và `updatedBy`) khi chi tiết cần; list chỉ trả nếu module doc nói rõ.
- Khi user bị xóa (không xảy ra vì chỉ khóa) FK `SetNull`.

## 2. Sổ biến động tồn — `BienDongTonKho` (P-13)

Bảng **chỉ thêm** (append-only): không sửa, không xóa.

| Trường | Ý nghĩa |
|---|---|
| `id` | uuid |
| `soLoId`, `viTriId` | dòng tồn bị tác động |
| `loai` (`LoaiBienDong`) | `nhap_kho`, `xuat_kho`, `huy_nhap`, `huy_xuat`, `chuyen_di`, `chuyen_den`, `dieu_chinh` |
| `soLuongThayDoi` | số nguyên **có dấu**, đơn vị cơ bản (+ tăng, − giảm) |
| `soLuongSau` | tồn của dòng đó **sau** thay đổi |
| `loaiThamChieu`, `thamChieuId` | chứng từ gây ra (`phieu_nhap_hang` / `phieu_xuat_hang` / `chuyen_vi_tri` / `dieu_chinh`) |
| `lyDo` | bắt buộc với `dieu_chinh` |
| `createdById`, `createdAt` | ai, khi nào |

Quy tắc:
1. `TonKhoService` là nơi duy nhất ghi `TonKho`; **mỗi lần ghi `TonKho` ghi kèm một dòng `BienDongTonKho` trong cùng transaction**. Không có đường ghi tồn khác.
2. Chuyển vị trí = hai dòng: `chuyen_di` (−n, vị trí nguồn) và `chuyen_den` (+n, vị trí đích), cùng `thamChieuId`.
3. Hủy phiếu hoàn tồn = dòng `huy_nhap` / `huy_xuat` đối ứng, không xóa dòng cũ.
4. **Bất biến đối soát:** với mọi `(soLoId, viTriId)`, `TonKho.soLuong = Σ soLuongThayDoi`. Job/test đối soát (§5) kiểm tra điều này.
5. Truy vấn thường gặp: lịch sử một lô, lịch sử một vị trí, các biến động của một chứng từ; có index hỗ trợ (P-05).

## 3. Nhật ký thao tác — `NhatKyHeThong` (P-14)

Bảng append-only ghi các thao tác nhạy cảm kèm giá trị trước/sau.

| Trường | Ý nghĩa |
|---|---|
| `hanhDong` | mã `<domain>.<verb>`, ví dụ `phieu_xuat.huy_sau_xuat_kho` |
| `doiTuong`, `doiTuongId` | loại và id đối tượng |
| `truoc`, `sau` | `Json?` — ảnh chụp các trường liên quan (không toàn bộ bản ghi, **không** chứa mật khẩu/token) |
| `lyDo` | lý do người dùng nhập (bắt buộc với hủy/điều chỉnh) |
| `userId`, `ip`, `requestId` | ngữ cảnh |
| `createdAt` | thời điểm |

### Thao tác bắt buộc ghi

| `hanhDong` | Khi nào |
|---|---|
| `user.create`, `user.lock`, `user.unlock`, `user.role_change`, `user.password_reset` | quản trị người dùng |
| `role.update` | sửa role |
| `hang_hoa.price_change` | đổi `giaNhap`/`giaHienThi`/`giaToiThieu` |
| `so_lo.expiry_change` | sửa `hanSuDung`/`ngaySX` |
| `ton_kho.adjust`, `ton_kho.transfer` | điều chỉnh, chuyển vị trí |
| `phieu_nhap.cancel`, `phieu_nhap.cancel_after_receipt` | hủy phiếu nhập |
| `phieu_xuat.cancel`, `phieu_xuat.cancel_after_issue`, `phieu_xuat.below_min_price` | hủy phiếu xuất; bán dưới giá tối thiểu |
| `phieu_thu.void`, `phieu_thanh_toan.void` | hủy phiếu thu / thanh toán |
| `nha_cung_cap.verify`, `nha_cung_cap.reject` | xác minh NCC |
| `khach_hang.status_change` | đổi trạng thái khách |

### Cài đặt (đề xuất)

- `AuditService.record({ hanhDong, doiTuong, doiTuongId, truoc, sau, lyDo }, tx?)` — nhận `tx` để ghi **cùng transaction** với thao tác; nếu thao tác rollback thì nhật ký cũng rollback.
- Lấy `userId`, `ip`, `requestId` từ ngữ cảnh request (AsyncLocalStorage do `nestjs-pino`/middleware cung cấp), không bắt service truyền tay.
- `GET /api/v1/audit` (chỉ `ADMIN`): lọc `hanhDong`, `doiTuong`, `doiTuongId`, `userId`, khoảng ngày; phân trang chuẩn.

## 4. Giữ lại

- `BienDongTonKho`, `NhatKyHeThong`: giữ **vĩnh viễn** (dược phẩm cần truy vết); đánh index, không xóa. Nếu bảng quá lớn, phân vùng hoặc archive theo năm — quyết định khi có số liệu thực.
- Chứng từ: giữ vĩnh viễn, không xóa.

## 5. Đối soát

Job đêm (xem [background-jobs.md](background-jobs.md)) và endpoint admin kiểm tra bất biến: `TonKho.soLuong = Σ BienDongTonKho.soLuongThayDoi` theo từng `(soLoId, viTriId)`; có lệch thì ghi log `error` và đưa vào kết quả `GET /api/v1/ton-kho/doi-soat` (chỉ `ADMIN`, đọc). Dùng làm test hồi quy trong e2e sau các kịch bản nhập/xuất/hủy.

## 6. Kiểm thử

- Unit: `AuditService.record` ghi đúng trường, nhận `tx`; không ghi trường nhạy cảm.
- Unit/e2e: mỗi thao tác trong bảng "bắt buộc ghi" tạo đúng một dòng `NhatKyHeThong`; thao tác rollback không để lại dòng.
- e2e tồn kho: sau chuỗi nhập → chuyển → xuất → hủy xuất, bất biến đối soát giữ nguyên.
