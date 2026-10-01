# Module: phieu-thanh-toan

## 1. Mục đích
- Ghi nhận các lần thanh toán cho nhà cung cấp theo từng phiếu nhập; tính **công nợ phải trả**.
- Actors: `KE_TOAN`, `ADMIN` (lập, hủy); `QUAN_LY_KHO` (xem); `NHAN_VIEN_KHO` không truy cập.

## 2. Scope
### In scope
- Lập phiếu thanh toán gắn **một** phiếu nhập đã nhập kho; xem/lọc; hủy (void) có lý do.
- Công nợ theo phiếu nhập và theo NCC (`GET /nha-cung-cap/:id/cong-no`).
### Out of scope (phase 2)
- Thanh toán gộp nhiều phiếu trong một lần (phân bổ tự động theo FIFO); thanh toán trước (tạm ứng) chưa gắn phiếu; chiết khấu thanh toán; ngoại tệ/chênh lệch tỷ giá; đối soát ngân hàng; hạn thanh toán và nhắc nợ; in phiếu chi PDF.

## 3. Dependencies
- Cần có trước: [phieu-nhap-hang.md](phieu-nhap-hang.md), [nha-cung-cap.md](nha-cung-cap.md); `CodeGeneratorService`, `AuditService`, `ClockService`.
- Được dùng bởi: [bao-cao.md](bao-cao.md) (công nợ phải trả, aging).
- Thư viện ngoài: không thêm.

## 4. Data model
- Model: `PhieuThanhToan` (`maPhieuThanhToan`, `soTien`, `ngayThanhToan`, `phieuNhapHangId`).
- Trường: `maPhieuThanhToan` sinh `TT` + `yyMMdd` + 4 số; `soTien Decimal(15,2) > 0`; `ngayThanhToan` (`@db.Date`).
- **Đề xuất schema (P-10):** `phuongThuc` (`tien_mat | chuyen_khoan`), `ghiChu`, `createdAt`, `updatedAt`, `createdById`, `huyAt`, `huyById`, `lyDoHuy`; index `(phieuNhapHangId)`, `(ngayThanhToan)` (P-05); CHECK `so_tien > 0` (P-18).
- Phiếu **hiệu lực** ⇔ `huyAt IS NULL`.
- Công nợ không lưu số dư: `conNo(phiếu) = tongTien(phiếu) − Σ soTien hiệu lực`.

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/phieu-thanh-toan` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Danh sách phiếu thanh toán | `QueryPhieuThanhToanDto` | `PagedResponse<PhieuThanhToanResponseDto>` |
| GET | `/api/v1/phieu-thanh-toan/:id` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Chi tiết | — | `PhieuThanhToanResponseDto` |
| POST | `/api/v1/phieu-thanh-toan` | JWT | ADMIN, KE_TOAN | Lập phiếu thanh toán | `CreatePhieuThanhToanDto` | `PhieuThanhToanResponseDto` (201) |
| POST | `/api/v1/phieu-thanh-toan/:id/huy` | JWT | ADMIN, KE_TOAN | Hủy phiếu thanh toán | `HuyPhieuDto` | `PhieuThanhToanResponseDto` |
| GET | `/api/v1/nha-cung-cap/:id/cong-no` | JWT | ADMIN, QUAN_LY_KHO, KE_TOAN | Công nợ phải trả của NCC | `CongNoNccQueryDto` | `CongNoNccResponseDto` |

Không có `PATCH`/`DELETE`: phiếu đã lập là bất biến, sai thì hủy và lập lại. (N/A vì yêu cầu kế toán không sửa chứng từ.)

## 6. DTOs
### Request
- `CreatePhieuThanhToanDto { phieuNhapHangId: string; soTien: string; ngayThanhToan: string; phuongThuc: 'tien_mat' | 'chuyen_khoan'; ghiChu?: string | null }` — `soTien` `@IsPositiveMoney`; `ngayThanhToan` `@IsDateOnly`; `ghiChu` ≤ 255.
- `HuyPhieuDto { lyDo: string }` — `@IsNotEmpty @MaxLength(255)`.
### Response
- `PhieuThanhToanResponseDto { id; maPhieuThanhToan; soTien; ngayThanhToan; phuongThuc; ghiChu; phieuNhap: { id; maPhieuNhapHang; tongTien; conNoSauKhiTra: string; nhaCungCap: { id; maNCC; tenNCC } }; huyAt; huyBoi; lyDoHuy; daHuy: boolean; createdBy; createdAt }`.
- `CongNoNccResponseDto { nhaCungCap: { id; maNCC; tenNCC }; tongPhaiTra: string; daThanhToan: string; conNo: string; phieuConNo: { phieuNhapId; maPhieuNhapHang; ngayNhanHang; tongTien; daThanhToan; conNo; soNgayNo: number }[]; generatedAt }`.
### Query
- `QueryPhieuThanhToanDto extends PaginationQueryDto { phieuNhapHangId?; nhaCungCapId?; phuongThuc?; daHuy?: boolean; ngayThanhToanFrom?; ngayThanhToanTo?; createdById? }`; `q` trên `maPhieuThanhToan`, `phieuNhap.maPhieuNhapHang`, `nhaCungCap.tenNCC`; sort `ngayThanhToan`, `createdAt`, `soTien`; mặc định `ngayThanhToan:desc`.
- `CongNoNccQueryDto { chiConNo?: boolean (mặc định true) }`.

## 7. Business rules
- BR-01: Chỉ lập được cho phiếu nhập `da_nhap_kho` (`PHIEU_THANH_TOAN_RECEIPT_INVALID_STATE` nếu nháp/đã hủy).
- BR-02: `soTien > 0` và `soTien ≤ conNo` hiện tại của phiếu nhập — kiểm **trong transaction** với phiếu nhập bị khóa dòng (xem §9) để hai thanh toán đồng thời không vượt tổng (`PHIEU_THANH_TOAN_EXCEEDS_DEBT`, `details.conNo`).
- BR-03: `ngayThanhToan` không ở tương lai và không trước ngày nhận hàng của phiếu nhập (`PHIEU_THANH_TOAN_DATE_INVALID`).
- BR-04: Phiếu bất biến sau khi tạo. Sửa sai = hủy + lập lại.
- BR-05: **Hủy** chỉ khi phiếu chưa hủy (`PHIEU_THANH_TOAN_ALREADY_VOID`); bắt buộc `lyDo`; ghi `huyAt/huyById`; ghi `NhatKyHeThong` `phieu_thanh_toan.void`. Hủy làm `conNo` của phiếu nhập tăng lại.
- BR-06: Người lập không tự hủy phiếu của mình trừ `ADMIN` (đề xuất tách nhiệm vụ — chỉ áp dụng nếu bạn chốt Q-TT-2).
- BR-07: Công nợ NCC = Σ `conNo` các phiếu nhập `da_nhap_kho` (bỏ phiếu `da_huy`). `soNgayNo` = hôm nay − `ngayNhanHang` (hoặc − `hạn thanh toán` nếu có điều khoản, Q-TT-1).
- BR-08: NCC ngừng hoạt động vẫn được thanh toán nợ cũ.
- BR-09: Hủy phiếu nhập đã nhập kho bị chặn khi còn phiếu thanh toán hiệu lực (xem [phieu-nhap-hang.md](phieu-nhap-hang.md) BR-11).
- BR-10: Ghi log sự kiện `phieu_thanh_toan.created` / `voided`.

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai (`soTien ≤ 0`, ngày sai định dạng) | Dữ liệu gửi lên không hợp lệ |
| `PHIEU_THANH_TOAN_NOT_FOUND` | 404 | id không tồn tại | Không tìm thấy phiếu thanh toán |
| `PHIEU_NHAP_NOT_FOUND` | 404 | phiếu nhập không tồn tại | Không tìm thấy phiếu nhập hàng |
| `PHIEU_THANH_TOAN_RECEIPT_INVALID_STATE` | 409 | phiếu nhập chưa nhập kho / đã hủy | Chỉ thanh toán được cho phiếu nhập đã nhập kho |
| `PHIEU_THANH_TOAN_EXCEEDS_DEBT` | 422 | vượt công nợ còn lại | Số tiền thanh toán vượt quá số còn nợ ({conNo}) |
| `PHIEU_THANH_TOAN_DATE_INVALID` | 422 | ngày thanh toán sai | Ngày thanh toán không hợp lệ |
| `PHIEU_THANH_TOAN_ALREADY_VOID` | 409 | hủy phiếu đã hủy | Phiếu thanh toán đã được hủy trước đó |
| `NHA_CUNG_CAP_NOT_FOUND` | 404 | NCC không tồn tại (công nợ) | Không tìm thấy nhà cung cấp |
| `AUTH_FORBIDDEN` | 403 | thiếu quyền | Bạn không có quyền truy cập |

## 9. Service layer design
`PhieuThanhToanService`:
- `findAll(query: QueryPhieuThanhToanDto): Promise<PagedResponse<PhieuThanhToanResponseDto>>`
- `findOne(id: string): Promise<PhieuThanhToanResponseDto>`
- `create(dto: CreatePhieuThanhToanDto, actor: AuthenticatedUser): Promise<PhieuThanhToanResponseDto>` — `$transaction`: khóa phiếu nhập (cập nhật `updatedAt` làm khóa dòng, hoặc `SELECT … FOR UPDATE` qua `$queryRaw` tham số hóa), tính `conNo`, kiểm, sinh mã, tạo, log.
- `void(id: string, dto: HuyPhieuDto, actor: AuthenticatedUser): Promise<PhieuThanhToanResponseDto>` — `updateMany where huyAt IS NULL` + nhật ký.
- `congNoNhaCungCap(nhaCungCapId: string, query: CongNoNccQueryDto): Promise<CongNoNccResponseDto>` — tổng hợp bằng `groupBy`.
- `sumEffectivePayments(phieuNhapId: string, tx?): Promise<Decimal>` — dùng bởi `phieu-nhap-hang`, `bao-cao`.
- `hasEffectivePayments(phieuNhapId: string, tx?): Promise<boolean>`.

Transaction: `create` và `void`. Khóa đồng thời: dùng khóa dòng phiếu nhập trong `create` để chuỗi kiểm tra–ghi là tuần tự theo phiếu. Side effects: `AuditService`, `CodeGeneratorService('TT')`.

## 10. Controller layer
- Hai controller: `PhieuThanhToanController` và route `cong-no` đặt trong `NhaCungCapController` gọi `PhieuThanhToanService.congNoNhaCungCap` (để URL nằm dưới `nha-cung-cap`, giữ trách nhiệm tính công nợ ở module này).
- Guards: `GET` `@Roles(ADMIN, QUAN_LY_KHO, KE_TOAN)`; `POST` tạo và hủy `@Roles(ADMIN, KE_TOAN)`.

## 11. File layout
```
src/phieu-thanh-toan/
  phieu-thanh-toan.module.ts
  phieu-thanh-toan.controller.ts
  phieu-thanh-toan.service.ts
  phieu-thanh-toan.service.spec.ts
  phieu-thanh-toan.controller.spec.ts
  phieu-thanh-toan.rules.ts      # assertAmountWithinDebt, assertDateValid (hàm thuần)
  phieu-thanh-toan.rules.spec.ts
  phieu-thanh-toan.mapper.ts
  dto/
    create-phieu-thanh-toan.dto.ts
    query-phieu-thanh-toan.dto.ts
    cong-no-ncc-query.dto.ts
    phieu-thanh-toan-response.dto.ts
    cong-no-ncc-response.dto.ts
```
(`HuyPhieuDto` dùng chung từ `src/common/dto/huy-phieu.dto.ts`.)

## 12. Test plan
### Unit tests
- `create() — phiếu nhập đã nhập kho, soTien ≤ conNo → tạo, mã TT…0001, daHuy=false, conNoSauKhiTra đúng`
- `create() — soTien = đúng conNo → conNo về 0.00, trạng thái thanh toán da_thanh_toan`
- `create() — soTien > conNo → PHIEU_THANH_TOAN_EXCEEDS_DEBT với details.conNo`
- `create() — hai lần trả một phần cộng lại vượt tổng → lần hai bị từ chối`
- `create() — phiếu đã hủy một phiếu thanh toán trước đó → conNo tính lại, cho phép trả bù`
- `create() — phiếu nhập nháp → PHIEU_THANH_TOAN_RECEIPT_INVALID_STATE`
- `create() — phiếu nhập đã hủy → PHIEU_THANH_TOAN_RECEIPT_INVALID_STATE`
- `create() — phiếu nhập không tồn tại → PHIEU_NHAP_NOT_FOUND`
- `create() — soTien 0 / âm / 3 chữ số thập phân → VALIDATION_FAILED`
- `create() — ngày tương lai hoặc trước ngày nhận hàng → PHIEU_THANH_TOAN_DATE_INVALID`
- `create() — hai request đồng thời cùng trả phần còn lại → đúng một thành công`
- `create() — NCC ngừng hoạt động → vẫn tạo được`
- `void() — hủy có lý do → huyAt/By set, conNo của phiếu nhập tăng lại, nhật ký void`
- `void() — hủy lần hai → PHIEU_THANH_TOAN_ALREADY_VOID`
- `void() — thiếu lý do → VALIDATION_FAILED`
- `findAll() — lọc daHuy, nhaCungCapId, phuongThuc, khoảng ngày, q`
- `findOne() — không tồn tại → PHIEU_THANH_TOAN_NOT_FOUND`
- `congNoNhaCungCap() — chỉ tính phiếu da_nhap_kho, bỏ phiếu da_huy/cho_xac_nhan; trừ phiếu thanh toán hiệu lực; chiConNo=true bỏ phiếu đã trả hết`
- `congNoNhaCungCap() — soNgayNo tính theo ClockService giả`
- `sumEffectivePayments()/hasEffectivePayments() — bỏ qua phiếu đã hủy`
- `rules.assertAmountWithinDebt() — bằng/nhỏ hơn/lớn hơn conNo; Decimal chính xác (0.1+0.2)`
- `mapper — tiền là chuỗi 2 chữ số`
### E2E tests
- **Luồng:** nhập hàng (tổng 1.000.000) → xác nhận → thanh toán 400.000 (`conNo` 600.000) → 600.000 (`da_thanh_toan`) → thanh toán thêm 1 đồng → 422.
- Hủy một khoản → `conNo` tăng lại; hủy lần hai → 409.
- Thanh toán cho phiếu nháp → 409.
- `GET /nha-cung-cap/:id/cong-no` khớp tổng các phiếu; ngày nợ đúng.
- Đồng thời: hai `POST` cùng trả toàn bộ nợ → một 201, một 422.
- Ma trận role: `KE_TOAN`/`ADMIN` `POST` → 201; `QUAN_LY_KHO` `GET` → 200, `POST` → 403; `NHAN_VIEN_KHO` `GET` → 403.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / read | ✓ | ✓ | ✗ | ✓ |
| create | ✓ | ✗ | ✗ | ✓ |
| hủy | ✓ | ✗ | ✗ | ✓ |
| công nợ NCC | ✓ | ✓ | ✗ | ✓ |

## 14. Open questions
- **Q-TT-1**: NCC có **điều khoản thanh toán** (số ngày nợ) để tính hạn trả và phân loại quá hạn trong aging phải trả không? (liên quan Q-NCC-4)
- **Q-TT-2**: Có cần **tách nhiệm vụ** (người lập khác người hủy / cần duyệt khi hủy) cho phiếu thanh toán?
- **Q-TT-3**: Một lần trả tiền thực tế thường gộp **nhiều phiếu nhập** cùng NCC? Nếu có, cần chức năng thanh toán gộp (phân bổ vào nhiều phiếu), schema hiện chỉ có 1 phiếu nhập/1 phiếu thanh toán.
- **Q-TT-4**: Có thanh toán **tạm ứng** trước khi có phiếu nhập không?
- **Q-TT-5**: Có cần lưu **số chứng từ ngân hàng / tài khoản** cho thanh toán chuyển khoản?
