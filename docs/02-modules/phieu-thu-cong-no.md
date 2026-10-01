# Module: phieu-thu-cong-no

## 1. Mục đích
- Ghi nhận các lần thu tiền từ nhà thuốc theo từng phiếu xuất; tính **công nợ phải thu** của khách và theo phiếu.
- Actors: `KE_TOAN`, `ADMIN` (lập, hủy); `QUAN_LY_KHO` (xem); `NHAN_VIEN_KHO` không truy cập.

## 2. Scope
### In scope
- Lập phiếu thu gắn **một** phiếu xuất đã xuất kho; xem/lọc; hủy (void) có lý do.
- Công nợ theo phiếu xuất và theo khách (`GET /khach-hang/:id/cong-no`).
### Out of scope (phase 2)
- Thu gộp nhiều phiếu trong một lần (phân bổ tự động FIFO) và tiền thu dư/tạm ứng; chiết khấu thanh toán sớm; phạt trả chậm; đối soát ngân hàng; nhắc nợ tự động (email/SMS); biên bản đối chiếu công nợ; xóa nợ (write-off); in phiếu thu PDF.

## 3. Dependencies
- Cần có trước: [phieu-xuat-hang.md](phieu-xuat-hang.md), [khach-hang.md](khach-hang.md); `CodeGeneratorService`, `AuditService`, `ClockService`.
- Được dùng bởi: [bao-cao.md](bao-cao.md) (công nợ phải thu, aging), `phieu-xuat-hang` (kiểm hạn mức công nợ, hủy phiếu).
- Thư viện ngoài: không thêm.

## 4. Data model
- Model: `PhieuThuCongNo` (`maPhieuThuCongNo`, `soTien`, `ngayThanhToan`, `phieuXuatHangId`).
- Trường: `maPhieuThuCongNo` sinh `PT` + `yyMMdd` + 4 số; `soTien Decimal(15,2) > 0`; `ngayThanhToan` (`@db.Date`).
- **Đề xuất schema (P-10):** `phuongThuc` (`tien_mat | chuyen_khoan`), `ghiChu`, `createdAt`, `updatedAt`, `createdById`, `huyAt`, `huyById`, `lyDoHuy`; index `(phieuXuatHangId)`, `(ngayThanhToan)` (P-05); CHECK `so_tien > 0` (P-18).
- Phiếu **hiệu lực** ⇔ `huyAt IS NULL`.
- Công nợ không lưu số dư: `conNo(phiếu xuất) = tongTien − Σ soTien hiệu lực`; chỉ tính cho phiếu `da_xuat_kho` / `da_giao`.

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/phieu-thu-cong-no` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Danh sách phiếu thu | `QueryPhieuThuDto` | `PagedResponse<PhieuThuResponseDto>` |
| GET | `/api/v1/phieu-thu-cong-no/:id` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Chi tiết | — | `PhieuThuResponseDto` |
| POST | `/api/v1/phieu-thu-cong-no` | JWT | ADMIN, KE_TOAN | Lập phiếu thu | `CreatePhieuThuDto` | `PhieuThuResponseDto` (201) |
| POST | `/api/v1/phieu-thu-cong-no/:id/huy` | JWT | ADMIN, KE_TOAN | Hủy phiếu thu | `HuyPhieuDto` | `PhieuThuResponseDto` |
| GET | `/api/v1/khach-hang/:id/cong-no` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Công nợ phải thu của khách | `CongNoKhachQueryDto` | `CongNoKhachResponseDto` |

Không có `PATCH`/`DELETE`: phiếu bất biến, sai thì hủy và lập lại.

## 6. DTOs
### Request
- `CreatePhieuThuDto { phieuXuatHangId: string; soTien: string; ngayThanhToan: string; phuongThuc: 'tien_mat' | 'chuyen_khoan'; ghiChu?: string | null }` — `soTien` `@IsPositiveMoney`; `ngayThanhToan` `@IsDateOnly`; `ghiChu` ≤ 255.
- `HuyPhieuDto { lyDo: string }`.
### Response
- `PhieuThuResponseDto { id; maPhieuThuCongNo; soTien; ngayThanhToan; phuongThuc; ghiChu; phieuXuat: { id; maPhieuXuatHang; ngayXuatKho; tongTien; conNoSauKhiThu: string; khachHang: { id; maKH; tenKH } }; huyAt; huyBoi; lyDoHuy; daHuy: boolean; createdBy; createdAt }`.
- `CongNoKhachResponseDto { khachHang: { id; maKH; tenKH; hanMucCongNo: string | null }; tongPhaiThu: string; daThu: string; conNo: string; vuotHanMuc: boolean | null; phieuConNo: { phieuXuatId; maPhieuXuatHang; ngayXuatKho; tongTien; daThu; conNo; soNgayNo: number; nhomTuoiNo: '0-30'|'31-60'|'61-90'|'>90' }[]; generatedAt }`.
### Query
- `QueryPhieuThuDto extends PaginationQueryDto { phieuXuatHangId?; khachHangId?; phuongThuc?; daHuy?: boolean; ngayThanhToanFrom?; ngayThanhToanTo?; createdById? }`; `q` trên `maPhieuThuCongNo`, `phieuXuat.maPhieuXuatHang`, `khachHang.tenKH`; sort `ngayThanhToan`, `createdAt`, `soTien`; mặc định `ngayThanhToan:desc`.
- `CongNoKhachQueryDto { chiConNo?: boolean (mặc định true) }`.

## 7. Business rules
- BR-01: Chỉ lập được cho phiếu xuất `da_xuat_kho` hoặc `da_giao` (`PHIEU_THU_ORDER_INVALID_STATE` nếu chờ xử lý/đã hủy).
- BR-02: `soTien > 0` và `soTien ≤ conNo` hiện tại của phiếu xuất, kiểm **trong transaction** có khóa dòng phiếu xuất để hai phiếu thu đồng thời không vượt tổng (`PHIEU_THU_EXCEEDS_DEBT`, `details.conNo`).
- BR-03: `ngayThanhToan` không ở tương lai và không trước ngày xuất kho (`PHIEU_THU_DATE_INVALID`).
- BR-04: Phiếu bất biến; sai ⇒ hủy + lập lại.
- BR-05: **Hủy** chỉ khi chưa hủy (`PHIEU_THU_ALREADY_VOID`), bắt buộc `lyDo`, ghi `huyAt/huyById`, nhật ký `phieu_thu.void`. Hủy làm `conNo` tăng lại.
- BR-06: **Tuổi nợ** = hôm nay − ngày xuất kho (hoặc − hạn thanh toán nếu có điều khoản, Q-THU-1); nhóm `0-30`, `31-60`, `61-90`, `>90` ngày. Chỉ phiếu còn nợ (`conNo > 0`) được xếp nhóm.
- BR-07: Công nợ khách = Σ `conNo` các phiếu xuất `da_xuat_kho`/`da_giao`; phiếu `da_huy` và `cho_xu_ly` không tính.
- BR-08: `vuotHanMuc` = `conNo > hanMucCongNo` nếu khách có hạn mức, ngược lại `null`.
- BR-09: Khách ngừng hoạt động vẫn thu được nợ cũ.
- BR-10: Hủy phiếu xuất sau khi xuất kho bị chặn khi còn phiếu thu hiệu lực (xem [phieu-xuat-hang.md](phieu-xuat-hang.md) BR-13).
- BR-11: Log sự kiện `phieu_thu.created` / `voided`.

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai | Dữ liệu gửi lên không hợp lệ |
| `PHIEU_THU_NOT_FOUND` | 404 | id không tồn tại | Không tìm thấy phiếu thu công nợ |
| `PHIEU_XUAT_NOT_FOUND` | 404 | phiếu xuất không tồn tại | Không tìm thấy phiếu xuất hàng |
| `PHIEU_THU_ORDER_INVALID_STATE` | 409 | phiếu xuất chưa xuất kho / đã hủy | Chỉ thu tiền được cho phiếu xuất đã xuất kho |
| `PHIEU_THU_EXCEEDS_DEBT` | 422 | vượt công nợ còn lại | Số tiền thu vượt quá số còn nợ ({conNo}) |
| `PHIEU_THU_DATE_INVALID` | 422 | ngày thu sai | Ngày thu tiền không hợp lệ |
| `PHIEU_THU_ALREADY_VOID` | 409 | hủy phiếu đã hủy | Phiếu thu đã được hủy trước đó |
| `KHACH_HANG_NOT_FOUND` | 404 | khách không tồn tại (công nợ) | Không tìm thấy khách hàng |
| `AUTH_FORBIDDEN` | 403 | thiếu quyền | Bạn không có quyền truy cập |

## 9. Service layer design
`PhieuThuCongNoService`:
- `findAll(query: QueryPhieuThuDto): Promise<PagedResponse<PhieuThuResponseDto>>`
- `findOne(id: string): Promise<PhieuThuResponseDto>`
- `create(dto: CreatePhieuThuDto, actor: AuthenticatedUser): Promise<PhieuThuResponseDto>` — `$transaction`: khóa phiếu xuất, tính `conNo`, kiểm, sinh mã, tạo, log.
- `void(id: string, dto: HuyPhieuDto, actor: AuthenticatedUser): Promise<PhieuThuResponseDto>`
- `congNoKhachHang(khachHangId: string, query: CongNoKhachQueryDto): Promise<CongNoKhachResponseDto>`
- `getOutstandingByCustomer(khachHangId: string, tx?): Promise<Decimal>` — dùng bởi `phieu-xuat-hang` kiểm hạn mức.
- `sumEffectiveReceipts(phieuXuatId: string, tx?): Promise<Decimal>`, `hasEffectiveReceipts(phieuXuatId: string, tx?): Promise<boolean>`.
- `ageBucket(days: number): '0-30'|'31-60'|'61-90'|'>90'` — hàm thuần.

Transaction: `create`, `void`. Side effects: `AuditService`, `CodeGeneratorService('PT')`.

## 10. Controller layer
- `PhieuThuCongNoController`; route `cong-no` đặt trong `KhachHangController` gọi `PhieuThuCongNoService.congNoKhachHang` (URL dưới `khach-hang`, logic ở module này).
- Guards: `GET` `@Roles(ADMIN, QUAN_LY_KHO, KE_TOAN)`; `POST` tạo/hủy `@Roles(ADMIN, KE_TOAN)`.

## 11. File layout
```
src/phieu-thu-cong-no/
  phieu-thu-cong-no.module.ts
  phieu-thu-cong-no.controller.ts
  phieu-thu-cong-no.service.ts
  phieu-thu-cong-no.service.spec.ts
  phieu-thu-cong-no.controller.spec.ts
  phieu-thu-cong-no.rules.ts     # ageBucket, assertAmountWithinDebt, assertDateValid
  phieu-thu-cong-no.rules.spec.ts
  phieu-thu-cong-no.mapper.ts
  dto/
    create-phieu-thu.dto.ts
    query-phieu-thu.dto.ts
    cong-no-khach-query.dto.ts
    phieu-thu-response.dto.ts
    cong-no-khach-response.dto.ts
```

## 12. Test plan
### Unit tests
- `create() — phiếu xuất da_xuat_kho, soTien ≤ conNo → tạo, mã PT…0001, conNoSauKhiThu đúng`
- `create() — phiếu xuất da_giao → tạo được`
- `create() — soTien = đúng conNo → conNo 0.00, trangThaiThu da_thu_du`
- `create() — soTien > conNo → PHIEU_THU_EXCEEDS_DEBT với details.conNo`
- `create() — hai khoản liên tiếp cộng vượt tổng → khoản hai bị từ chối`
- `create() — sau khi hủy một khoản → conNo tăng lại, thu bù được`
- `create() — phiếu xuất cho_xu_ly / da_huy → PHIEU_THU_ORDER_INVALID_STATE`
- `create() — phiếu xuất không tồn tại → PHIEU_XUAT_NOT_FOUND`
- `create() — soTien 0 / âm / quá 2 chữ số thập phân → VALIDATION_FAILED`
- `create() — ngày tương lai / trước ngày xuất kho → PHIEU_THU_DATE_INVALID`
- `create() — hai request đồng thời cùng thu phần còn lại → đúng một thành công`
- `create() — khách ngừng hoạt động → vẫn thu được`
- `void() — hủy có lý do → huyAt/By set, conNo tăng, nhật ký phieu_thu.void`
- `void() — hủy lần hai → PHIEU_THU_ALREADY_VOID`
- `void() — thiếu lý do → VALIDATION_FAILED`
- `findAll() — lọc daHuy, khachHangId, phuongThuc, khoảng ngày, q; sắp xếp`
- `findOne() — không tồn tại → PHIEU_THU_NOT_FOUND`
- `congNoKhachHang() — chỉ tính phiếu da_xuat_kho/da_giao, bỏ da_huy/cho_xu_ly; trừ phiếu thu hiệu lực; chiConNo=true bỏ phiếu trả hết`
- `congNoKhachHang() — xếp nhóm tuổi nợ đúng ở các biên 30/31, 60/61, 90/91 ngày (ClockService giả)`
- `congNoKhachHang() — vuotHanMuc đúng khi có / không có hạn mức`
- `getOutstandingByCustomer() — tổng nợ nhiều phiếu, bỏ phiếu thu đã hủy`
- `sumEffectiveReceipts()/hasEffectiveReceipts() — bỏ phiếu đã hủy`
- `rules.ageBucket() — bảng biên`
- `rules.assertAmountWithinDebt() — Decimal chính xác`
- `mapper — tiền là chuỗi 2 chữ số`
### E2E tests
- **Luồng:** nhập → xuất kho phiếu 1.000.000 → thu 300.000 → 700.000 (`da_thu_du`) → thu thêm 1 đồng → 422.
- Hủy một khoản → `conNo` tăng; hủy lần hai → 409; hủy phiếu xuất khi còn phiếu thu → 409.
- Thu cho phiếu chờ xử lý → 409.
- `GET /khach-hang/:id/cong-no` khớp tổng các phiếu; nhóm tuổi nợ đúng (dựng phiếu bằng cách đặt `ngayXuatKho` trong DB cho test).
- Đồng thời: hai `POST` cùng thu toàn bộ → một 201, một 422.
- Ma trận role: `KE_TOAN`/`ADMIN` `POST` → 201; `QUAN_LY_KHO` `GET` → 200, `POST` → 403; `NHAN_VIEN_KHO` `GET` → 403.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read | ✓ | ✓ | ✗ | ✓ |
| create | ✓ | ✗ | ✗ | ✓ |
| hủy | ✓ | ✗ | ✗ | ✓ |
| công nợ khách | ✓ | ✓ | ✗ | ✓ |

## 14. Open questions
- **Q-THU-1**: Có **hạn thanh toán/số ngày nợ** theo từng khách (liên quan Q-KH-1) để tính nợ quá hạn thay vì tính tuổi nợ từ ngày xuất kho?
- **Q-THU-2**: Khách thường trả một lần cho **nhiều phiếu**? Nếu có, cần thu gộp và phân bổ (hiện chỉ gắn một phiếu xuất).
- **Q-THU-3**: Có **chiết khấu thanh toán**, làm tròn/xóa nợ nhỏ (write-off), hoặc thu **tạm ứng** trước khi xuất hàng?
- **Q-THU-4**: Có cần lưu thông tin ngân hàng/số chứng từ và đối soát với sao kê?
- **Q-THU-5**: Có cần nhắc nợ/báo cáo nợ quá hạn tự động (job, email/SMS)?
- **Q-THU-6**: Có cần **tách nhiệm vụ** (người hủy khác người lập) cho phiếu thu (liên quan Q-TT-2)?
