# Module: ton-kho

Module có **rủi ro cao nhất** về tính đúng đắn số liệu. Mọi thay đổi tồn đi qua một chỗ duy nhất (`TonKhoService`) và để lại dấu vết trong sổ biến động.

## 1. Mục đích
- Cho biết tồn kho theo từng **(lô × vị trí)**; tổng hợp theo hàng/kho; gợi ý lô xuất theo FEFO.
- Thực hiện các thay đổi tồn: tăng/giảm theo chứng từ (nội bộ, gọi từ phiếu nhập/xuất), chuyển vị trí, điều chỉnh (kiểm kê).
- Ghi sổ biến động `BienDongTonKho` cho mọi thay đổi và đối soát với tồn hiện tại.
- Actors: `NHAN_VIEN_KHO`, `QUAN_LY_KHO`, `ADMIN` (thao tác kho); `KE_TOAN` (xem).

## 2. Scope
### In scope
- Truy vấn tồn: theo dòng, tổng hợp, sổ biến động, đối soát.
- `GET goi-y-xuat` (FEFO), `POST chuyen-vi-tri`, `POST dieu-chinh`.
- API nội bộ cho phiếu: `increase`, `decrease`, `assertColdChain`.
- Quy tắc kho lạnh, không âm, cập nhật đồng thời an toàn.
- Job đối soát đêm.
### Out of scope (phase 2)
- **Giữ chỗ tồn (reservation/allocation)** khi phiếu xuất còn nháp (xem Q-TK-1), kiểm kê theo đợt có phiếu kiểm kê riêng, tồn tối thiểu/đặt hàng lại, tồn theo nhiều chủ sở hữu, đóng gói/tách lô, hàng đang vận chuyển (in-transit).

## 3. Dependencies
- Cần có trước: [so-lo.md](so-lo.md), [kho-vi-tri.md](kho-vi-tri.md), [hang-hoa.md](hang-hoa.md), [ty-le-quy-doi.md](ty-le-quy-doi.md); `audit`, `ClockService`.
- Được dùng bởi: [phieu-nhap-hang.md](phieu-nhap-hang.md), [phieu-xuat-hang.md](phieu-xuat-hang.md), `bao-cao`.
- Thư viện ngoài: `@nestjs/schedule` (job đối soát).

## 4. Data model
- Model: `TonKho` (`soLuong`, `soLoId`, `viTriId`, `@@unique([soLoId, viTriId])`), **mới** `BienDongTonKho` (P-13).
- Quy tắc trường `TonKho`: `soLuong Int ≥ 0` (đơn vị cơ bản; thêm CHECK, P-18); chỉ `TonKhoService` được ghi. Dòng `soLuong = 0` được giữ (không xóa) để bảo toàn lịch sử, `conTon` lọc bỏ.
- `BienDongTonKho`: xem [audit-trail.md](../03-cross-cutting/audit-trail.md) §2 (append-only; `soLuongThayDoi` có dấu; `soLuongSau`; `loaiThamChieu`/`thamChieuId`; `lyDo`; `createdById`).
- Đề xuất: P-05 (index), P-13, P-18, `TonKho.updatedAt` (P-02).

## 5. API endpoints
| Method | Path | Auth | Roles | Mô tả ngắn | DTO request | DTO response |
|---|---|---|---|---|---|---|
| GET | `/api/v1/ton-kho` | JWT | mọi role | Tồn theo dòng (lô × vị trí) | `QueryTonKhoDto` | `PagedResponse<TonKhoResponseDto>` |
| GET | `/api/v1/ton-kho/:id` | JWT | mọi role | Một dòng tồn | — | `TonKhoResponseDto` |
| GET | `/api/v1/ton-kho/tong-hop` | JWT | mọi role | Tổng hợp theo hàng hóa | `QueryTonKhoTongHopDto` | `PagedResponse<TonKhoTongHopDto>` |
| GET | `/api/v1/ton-kho/goi-y-xuat` | JWT | mọi role | Gợi ý lô xuất theo FEFO | `GoiYXuatQueryDto` | `GoiYXuatResponseDto` |
| GET | `/api/v1/ton-kho/bien-dong` | JWT | mọi role | Sổ biến động tồn | `QueryBienDongDto` | `PagedResponse<BienDongTonKhoResponseDto>` |
| POST | `/api/v1/ton-kho/chuyen-vi-tri` | JWT | ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO | Chuyển hàng giữa hai vị trí | `ChuyenViTriDto` | `ChuyenViTriResponseDto` |
| POST | `/api/v1/ton-kho/dieu-chinh` | JWT | ADMIN, QUAN_LY_KHO | Điều chỉnh tồn (kiểm kê) | `DieuChinhTonKhoDto` | `TonKhoResponseDto` |
| GET | `/api/v1/ton-kho/doi-soat` | JWT | ADMIN | Đối soát tồn với sổ biến động | — | `DoiSoatResponseDto` |

Route tĩnh (`tong-hop`, `goi-y-xuat`, `bien-dong`, `doi-soat`) khai báo **trước** `/:id`.

## 6. DTOs
### Request
- `ChuyenViTriDto { soLoId: string; tuViTriId: string; denViTriId: string; soLuong: number; donViTinh?: string; lyDo?: string }` — `soLuong` `@IsQuantity`; `donViTinh` mặc định đơn vị cơ bản (quy đổi theo hệ số); `lyDo` ≤ 255.
- `DieuChinhTonKhoDto { soLoId: string; viTriId: string; soLuongMoi: number; lyDo: string }` — `soLuongMoi` `@IsInt @Min(0)` (số đếm thực tế, đơn vị cơ bản); `lyDo` `@IsNotEmpty @MaxLength(255)`.
- `GoiYXuatQueryDto { hangHoaId: string; soLuong: number; donViTinh?: string; khoId?: string }`.
### Response
- `TonKhoResponseDto { id; soLuong: number; donViCoBan: string; soLo: { id; tenLo; hanSuDung; trangThai; soNgayConLai }; hangHoa: { id; maSP; tenSP }; viTri: { id; tenViTri; isCapDong; kho: { id; tenKho } }; updatedAt }`.
- `TonKhoTongHopDto { hangHoa: { id; maSP; tenSP; donViCoBan }; tongTon; tonKhaDung; tonCanDate; tonHetHan; soLo: number }` — `tonKhaDung` = tồn các lô chưa hết hạn; `tonCanDate` ⊂ `tonKhaDung`.
- `GoiYXuatResponseDto { hangHoaId; yeuCau: number; daPhanBo: number; thieu: number; phanBo: { soLoId; tenLo; hanSuDung; viTriId; tenViTri; soLuong: number }[] }` — luôn 200; `thieu > 0` khi không đủ.
- `ChuyenViTriResponseDto { tu: TonKhoResponseDto; den: TonKhoResponseDto }`.
- `BienDongTonKhoResponseDto { id; loai; soLuongThayDoi; soLuongSau; soLo: { id; tenLo }; viTri: { id; tenViTri }; thamChieu: { loai; id } | null; lyDo; nguoiThucHien: { id; maNV; hoTen }; createdAt }`.
- `DoiSoatResponseDto { kiemTraLuc; soDongKiemTra: number; soDongLech: number; chiTietLech: { soLoId; viTriId; tonKho: number; tongBienDong: number }[] }`.
### Query
- `QueryTonKhoDto extends PaginationQueryDto { khoId?; viTriId?; hangHoaId?; soLoId?; loaiHangId?; isCanGiuLanh?: boolean; trangThaiLo?: enum; conTon?: boolean (mặc định true) }`; `q` trên `soLo.tenLo`, `hangHoa.tenSP/maSP`; sort `hanSuDung`, `soLuong`, `tenSP`, `updatedAt`; mặc định `hanSuDung:asc`.
- `QueryTonKhoTongHopDto extends PaginationQueryDto { khoId?; loaiHangId?; isCanGiuLanh?: boolean; chiHetHang?: boolean; q? }`; sort `tongTon`, `tenSP`; mặc định `tenSP:asc`.
- `QueryBienDongDto extends PaginationQueryDto { soLoId?; viTriId?; hangHoaId?; loai?: enum; thamChieuId?: uuid; createdAtFrom?; createdAtTo? }`; sort `createdAt`; mặc định `createdAt:desc`.

## 7. Business rules
- BR-01: `TonKho.soLuong ≥ 0` luôn đúng (CHECK ở DB + kiểm tra ở service).
- BR-02: **Giảm tồn nguyên tử:** `UPDATE … SET so_luong = so_luong − n WHERE id = … AND so_luong ≥ n`; `count ≠ 1` ⇒ `TON_KHO_INSUFFICIENT` (kèm `details.conLai`). Không đọc rồi ghi.
- BR-03: **Tăng tồn** dùng `upsert` tăng theo `(soLoId, viTriId)`; nếu race tạo dòng mới gây xung đột unique thì thử lại một lần.
- BR-04: **Mỗi lần ghi `TonKho` kèm đúng một dòng `BienDongTonKho` trong cùng transaction**; `soLuongSau` đọc ngay sau khi ghi trong transaction. Bất biến: với mỗi `(soLoId, viTriId)`, `TonKho.soLuong = Σ soLuongThayDoi`.
- BR-05: **Chuỗi lạnh:** hàng `isCanGiuLanh` chỉ được **đưa vào** (nhập, chuyển đến, điều chỉnh tăng) vị trí `isCapDong`; vi phạm ⇒ `TON_KHO_COLD_CHAIN_VIOLATION`. Hàng thường vào vị trí cấp đông được phép (không chặn).
- BR-06: Vị trí nhận phải đang hoạt động (`ViTriService.assertReceivable`); xuất từ vị trí đã ngừng vẫn được.
- BR-07: **Chuyển vị trí:** cùng lô, `tuViTriId ≠ denViTriId` (`TON_KHO_SAME_LOCATION`), đủ tồn nguồn, quy tắc BR-05/06 cho đích; tạo hai dòng biến động `chuyen_di` (−n) và `chuyen_den` (+n) cùng `thamChieuId`; lô hết hạn **được** chuyển (ví dụ sang khu biệt trữ). Ghi nhật ký `ton_kho.transfer`.
- BR-08: **Điều chỉnh:** `delta = soLuongMoi − tồnHiệnTại`; `delta = 0` ⇒ `TON_KHO_ADJUST_NO_CHANGE`; bắt buộc `lyDo`; chỉ `QUAN_LY_KHO`/`ADMIN`; dùng điều kiện `soLuong = tồnHiệnTại` khi ghi, lệch do cập nhật đồng thời ⇒ `COMMON_CONCURRENT_UPDATE`. Điều chỉnh tăng tuân thủ BR-05/06; điều chỉnh về 0 để hủy hàng hết hạn là trường hợp hợp lệ. Ghi nhật ký `ton_kho.adjust` (trước/sau/lý do).
- BR-09: **Gợi ý FEFO:** chỉ xét lô chưa hết hạn (và đạt `MIN_SHELF_LIFE_DAYS_ISSUE` nếu bật), `soLuong > 0`, vị trí còn xuất được; sắp theo `hanSuDung` tăng, rồi `soLuong` giảm (ít vị trí nhất), rồi `id`; phân bổ lần lượt đến đủ số cần; thiếu thì trả `thieu`. Chỉ gợi ý, **không giữ chỗ**.
- BR-10: Quy đổi đơn vị dùng hệ số của hàng (`ty-le-quy-doi`); `donViTinh` lạ ⇒ `VALIDATION_FAILED`.
- BR-11: Đọc tồn không bị chặn bởi hạn lô; lô hết hạn vẫn hiện, được đánh dấu `trangThai = het_han`.
- BR-12: Đối soát (`doi-soat`): so `TonKho.soLuong` với `Σ BienDongTonKho.soLuongThayDoi`; lệch ⇒ báo, **không tự sửa**.
- BR-13: Hai người cùng lập phiếu xuất nháp trên cùng tồn không giữ chỗ lẫn nhau; xung đột được chặn ở lúc **xuất kho** (BR-02). Hệ quả đã biết, xem Q-TK-1.

## 8. Error cases
| Mã lỗi | HTTP | Khi nào | Message (VN) |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | DTO sai; đơn vị tính lạ | Dữ liệu gửi lên không hợp lệ |
| `TON_KHO_NOT_FOUND` | 404 | `GET :id` không có | Không tìm thấy dòng tồn kho |
| `SO_LO_NOT_FOUND` / `VI_TRI_NOT_FOUND` | 404 | lô / vị trí không tồn tại | Không tìm thấy số lô / vị trí |
| `TON_KHO_INSUFFICIENT` | 409 | không đủ tồn để giảm/chuyển | Số lượng tồn không đủ (còn {conLai}) |
| `TON_KHO_COLD_CHAIN_VIOLATION` | 422 | hàng lạnh vào vị trí thường | Hàng cần bảo quản lạnh chỉ được đặt ở vị trí cấp đông |
| `TON_KHO_SAME_LOCATION` | 422 | chuyển trong cùng vị trí | Vị trí đích phải khác vị trí nguồn |
| `TON_KHO_ADJUST_NO_CHANGE` | 422 | số mới bằng tồn hiện tại | Số lượng điều chỉnh trùng với tồn hiện tại |
| `VI_TRI_INACTIVE` | 422 | đích là vị trí đã ngừng | Vị trí đã ngừng sử dụng |
| `COMMON_CONCURRENT_UPDATE` | 409 | điều chỉnh đụng cập nhật khác | Dữ liệu vừa được người khác thay đổi, vui lòng tải lại và thử lại |
| `AUTH_FORBIDDEN` | 403 | thiếu quyền | Bạn không có quyền truy cập |

## 9. Service layer design
`TonKhoService` (public API cho phiếu, dùng `tx` bắt buộc):
- `increase(input: StockMove, actor: AuthenticatedUser, tx: Prisma.TransactionClient): Promise<TonKho>` — kiểm BR-05/06, `upsert` tăng, ghi biến động.
- `decrease(input: StockMove, actor: AuthenticatedUser, tx: Prisma.TransactionClient): Promise<TonKho>` — BR-02, ghi biến động; `StockMove = { soLoId; viTriId; soLuongCoBan; loai: LoaiBienDong; thamChieu?: { loai: string; id: string }; lyDo?: string; boQuaKiemTraViTriHoatDong?: boolean }`; cờ `boQuaKiemTraViTriHoatDong` chỉ dùng cho thao tác hoàn tác (`huy_xuat`, `huy_nhap`) để vẫn hoàn tồn được về vị trí đã ngừng sử dụng; kiểm chuỗi lạnh vẫn áp dụng.
- `assertColdChain(hangHoa: { isCanGiuLanh: boolean }, viTri: { isCapDong: boolean }): void` — hàm thuần.
- `getQuantity(soLoId: string, viTriId: string, tx?): Promise<number>`.

`TonKhoService` (API cho controller):
- `findAll(query: QueryTonKhoDto)`, `findOne(id)`, `tongHop(query: QueryTonKhoTongHopDto)`, `goiYXuat(query: GoiYXuatQueryDto)`, `bienDong(query: QueryBienDongDto)`.
- `chuyenViTri(dto: ChuyenViTriDto, actor): Promise<ChuyenViTriResponseDto>` — `$transaction`: `decrease` nguồn + `increase` đích + nhật ký.
- `dieuChinh(dto: DieuChinhTonKhoDto, actor): Promise<TonKhoResponseDto>` — `$transaction` với kiểm đồng thời.
- `doiSoat(): Promise<DoiSoatResponseDto>` — cũng dùng bởi job `stock-reconcile`.

Transaction: mọi method ghi đều trong `$transaction` (do nơi gọi mở khi từ phiếu). Side effects: `AuditService` (`ton_kho.transfer`, `ton_kho.adjust`), log `stock.changed`.

## 10. Controller layer
- 1–1 với service. Guards: `GET` mọi role; `POST chuyen-vi-tri` `@Roles(ADMIN, QUAN_LY_KHO, NHAN_VIEN_KHO)`; `POST dieu-chinh` `@Roles(ADMIN, QUAN_LY_KHO)`; `GET doi-soat` `@Roles(ADMIN)`.
- Không có endpoint tăng/giảm tồn trực tiếp: chỉ phiếu hoặc điều chỉnh/chuyển.

## 11. File layout
```
src/ton-kho/
  ton-kho.module.ts
  ton-kho.controller.ts
  ton-kho.service.ts
  ton-kho.service.spec.ts
  ton-kho.controller.spec.ts
  ton-kho.rules.ts               # assertColdChain, allocateFefo (hàm thuần)
  ton-kho.rules.spec.ts
  ton-kho.mapper.ts
  ton-kho.types.ts               # StockMove
  jobs/
    expiry-scan.job.ts
    stock-reconcile.job.ts
  dto/
    query-ton-kho.dto.ts
    query-ton-kho-tong-hop.dto.ts
    goi-y-xuat-query.dto.ts
    query-bien-dong.dto.ts
    chuyen-vi-tri.dto.ts
    dieu-chinh-ton-kho.dto.ts
    ton-kho-response.dto.ts
    goi-y-xuat-response.dto.ts
    bien-dong-response.dto.ts
    doi-soat-response.dto.ts
```

## 12. Test plan
### Unit tests
- `increase() — dòng chưa có → tạo dòng, soLuong = n, ghi 1 biến động soLuongSau = n`
- `increase() — dòng có sẵn → cộng dồn, soLuongSau đúng`
- `increase() — hàng lạnh vào vị trí thường → TON_KHO_COLD_CHAIN_VIOLATION`
- `increase() — hàng thường vào vị trí cấp đông → cho phép`
- `increase() — vị trí ngừng sử dụng → VI_TRI_INACTIVE`
- `increase() — race tạo dòng (unique violation) → thử lại một lần và thành công`
- `decrease() — đủ tồn → trừ, ghi biến động âm`
- `decrease() — đúng bằng tồn → về 0, dòng được giữ`
- `decrease() — thiếu → TON_KHO_INSUFFICIENT với details.conLai; không ghi biến động`
- `decrease() — dòng không tồn tại → TON_KHO_INSUFFICIENT với conLai 0`
- `decrease() — vị trí ngừng sử dụng vẫn trừ được`
- `decrease() — lô hết hạn vẫn trừ được (kiểm hạn là việc của phiếu)`
- `chuyenViTri() — hợp lệ → nguồn −n, đích +n, hai biến động cùng thamChieuId, nhật ký`
- `chuyenViTri() — cùng vị trí → TON_KHO_SAME_LOCATION`
- `chuyenViTri() — vượt tồn nguồn → TON_KHO_INSUFFICIENT và không thay đổi gì (rollback)`
- `chuyenViTri() — hàng lạnh sang vị trí thường → TON_KHO_COLD_CHAIN_VIOLATION`
- `chuyenViTri() — đơn vị hộp → quy đổi đúng ra đơn vị cơ bản`
- `chuyenViTri() — lô hết hạn → chuyển được`
- `dieuChinh() — tăng từ 10 lên 14 → biến động +4 loai dieu_chinh, nhật ký trước/sau/lý do`
- `dieuChinh() — giảm về 0 → biến động −tồn`
- `dieuChinh() — số mới bằng tồn → TON_KHO_ADJUST_NO_CHANGE`
- `dieuChinh() — thiếu lyDo → VALIDATION_FAILED`
- `dieuChinh() — dòng chưa tồn tại, soLuongMoi > 0 → tạo dòng (kiểm chuỗi lạnh)`
- `dieuChinh() — tồn đổi giữa lúc đọc và ghi → COMMON_CONCURRENT_UPDATE`
- `goiYXuat() — nhiều lô → ưu tiên hạn gần nhất, bỏ lô hết hạn`
- `goiYXuat() — cùng hạn → ưu tiên dòng nhiều tồn hơn`
- `goiYXuat() — không đủ → trả thieu > 0 và phanBo là phần có thể`
- `goiYXuat() — bật MIN_SHELF_LIFE_DAYS_ISSUE → bỏ lô dưới ngưỡng`
- `allocateFefo() — hàm thuần: bảng case (đủ ở lô đầu, trải nhiều lô, thiếu, tồn 0)`
- `tongHop() — tách tonKhaDung / tonCanDate / tonHetHan đúng theo ngày (ClockService giả)`
- `findAll() — conTon mặc định true loại dòng 0; lọc khoId, hangHoaId, trangThaiLo`
- `bienDong() — lọc theo loai, soLoId, khoảng ngày; sắp mới nhất trước`
- `doiSoat() — tồn khớp sổ → soDongLech 0; cố ý lệch → liệt kê chiTietLech`
- `rules.assertColdChain() — bảng chân trị (isCanGiuLanh × isCapDong)`
### E2E tests
- Dựng hàng + lô + 2 vị trí (1 cấp đông); nhập hàng (qua phiếu nhập) → `GET /ton-kho` đúng; `tong-hop` đúng.
- Chuyển vị trí hợp lệ → hai dòng tồn đổi đúng, `bien-dong` có hai dòng cùng tham chiếu.
- Chuyển hàng lạnh sang vị trí thường → 422; chuyển quá tồn → 409 và tồn nguyên vẹn.
- Điều chỉnh bởi `QUAN_LY_KHO` thành công; bởi `NHAN_VIEN_KHO` → 403; thiếu lý do → 400; không đổi → 422.
- `goi-y-xuat` với 3 lô (hết hạn, hạn gần, hạn xa) → bỏ lô hết hạn, ưu tiên hạn gần; yêu cầu vượt tồn → `thieu > 0`.
- **Đồng thời:** tồn 10, hai request giảm 7 chạy song song (`Promise.all`) → đúng một thành công, một 409, tồn cuối = 3.
- **Bất biến đối soát:** sau chuỗi nhập → chuyển → điều chỉnh → xuất → hủy xuất, `GET /ton-kho/doi-soat` trả `soDongLech = 0`.
- Ma trận role: `KE_TOAN` xem được `GET`, `POST chuyen-vi-tri` → 403; `doi-soat` chỉ ADMIN.

## 13. Permissions
| Action | ADMIN | QUAN_LY_KHO | NHAN_VIEN_KHO | KE_TOAN |
|---|---|---|---|---|
| list / tổng hợp / biến động / gợi ý xuất | ✓ | ✓ | ✓ | ✓ |
| chuyển vị trí | ✓ | ✓ | ✓ | ✗ |
| điều chỉnh tồn | ✓ | ✓ | ✗ | ✗ |
| đối soát | ✓ | ✗ | ✗ | ✗ |

## 14. Open questions
- **Q-TK-1**: Có cần **giữ chỗ tồn** khi lập phiếu xuất (để hai phiếu nháp không cùng "ăn" một lượng tồn, hiển thị `tồn khả dụng = tồn − đã giữ`)? Đề xuất hiện tại: không, chỉ chặn lúc xuất kho. Nếu cần: thêm `TonKho.soLuongGiu` hoặc bảng `GiuCho`.
- **Q-TK-2**: Quy trình **kiểm kê** thực tế: kiểm toàn bộ theo đợt (cần phiếu kiểm kê, khóa kho tạm thời) hay điều chỉnh lẻ từng lô như đề xuất?
- **Q-TK-3**: Hàng thường có được để ở vị trí cấp đông không (hiện cho phép)? Hàng lạnh có bắt buộc 100% ở vị trí cấp đông (hiện bắt buộc)?
- **Q-TK-4**: Hiển thị số lượng cho người dùng theo đơn vị nào — chỉ đơn vị cơ bản, hay quy đổi dạng "3 hộp 2 vỉ 5 viên"?
- **Q-TK-5**: Hàng hết hạn còn tồn xử lý bằng điều chỉnh về 0 (hủy) hay chuyển sang một vị trí/kho "hàng hủy" trước khi tiêu hủy chính thức?
- **Q-TK-6**: Có cần tồn đầu kỳ nhập bằng phiếu nhập "đầu kỳ" hay bằng điều chỉnh khi đưa hệ thống vào chạy? (liên quan [seed-strategy.md](../01-data/seed-strategy.md) §7).
