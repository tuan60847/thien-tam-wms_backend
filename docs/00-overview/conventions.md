# Quy ước chung

Áp dụng cho mọi module. Các file `03-cross-cutting/` và `06-api/` đi sâu từng chủ đề; file này là bản tóm tắt ràng buộc.

## 1. Ngôn ngữ

| Thứ | Ngôn ngữ |
|---|---|
| Nghiệp vụ, tên model/field theo domain (`HangHoa`, `soLuong`, `hanSuDung`), giá trị trạng thái (`cho_xac_nhan`) | Tiếng Việt không dấu (giữ nguyên như schema hiện có) |
| Tên class, method, biến, hàm kỹ thuật (`findAll`, `PaginationQueryDto`, `AppException`) | Tiếng Anh |
| Mã lỗi (`code`) | `<DOMAIN>_<REASON>`: domain theo tên nghiệp vụ, reason tiếng Anh. Ví dụ `SO_LO_EXPIRED`, `TON_KHO_INSUFFICIENT` |
| Message trả về người dùng (`message`) | Tiếng Việt, thân thiện, không lộ chi tiết kỹ thuật |
| Log, comment trong code, commit message | Tiếng Anh |
| Tên test (`describe`/`it`) | Tiếng Việt (mô tả hành vi) — như module Auth hiện có |
| Tài liệu trong `docs/` | Tiếng Việt cho nghiệp vụ, tiếng Anh cho identifier |

## 2. Đặt tên

| Đối tượng | Quy tắc | Ví dụ |
|---|---|---|
| Thư mục module | kebab-case, tên nghiệp vụ | `src/hang-hoa/`, `src/phieu-nhap-hang/` |
| File | `<module>.<loại>.ts` kebab-case | `hang-hoa.service.ts`, `create-hang-hoa.dto.ts` |
| Class | PascalCase | `HangHoaService`, `CreateHangHoaDto`, `HangHoaResponseDto` |
| DTO | `Create<X>Dto`, `Update<X>Dto` (= `PartialType`), `Query<X>Dto`, `<X>ResponseDto` | `QuerySoLoDto` |
| Biến/method | camelCase tiếng Anh | `confirmReceipt()`, `findByLot()` |
| Model Prisma | PascalCase theo schema; cột snake_case qua `@map` | giữ nguyên hiện có |
| URL | kebab-case, danh từ nghiệp vụ, **không** thêm "s" | `/api/v1/hang-hoa`, `/api/v1/phieu-nhap-hang` |
| Hành động trên resource | `POST /<resource>/:id/<hành-động-kebab>` | `POST /phieu-nhap-hang/:id/xac-nhan` |
| Query param | camelCase | `hangHoaId`, `pageSize` |
| Biến môi trường | UPPER_SNAKE | `JWT_ACCESS_TTL` |
| Migration | `<timestamp>_<verb>_<subject>` snake_case | `add_audit_fields`, `add_ton_kho_bien_dong` |
| Commit | Conventional Commits, tiếng Anh | `feat(hang-hoa): add create endpoint` |

## 3. Cấu trúc một module

```
src/<module>/
  <module>.module.ts
  <module>.controller.ts
  <module>.service.ts
  <module>.service.spec.ts          # unit test đặt cạnh file nguồn
  <module>.controller.spec.ts
  dto/
    create-<module>.dto.ts
    update-<module>.dto.ts
    query-<module>.dto.ts
    <module>-response.dto.ts
  entities/                          # chỉ khi cần kiểu riêng ngoài Prisma
  <module>.mapper.ts                 # Prisma entity -> response DTO
```

**Quyết định về vị trí test:** unit test đặt **cạnh** file nguồn (`*.spec.ts`), đúng như module `auth` hiện có và `vitest.config.ts` (`include: ['**/*.spec.ts']`). Mẫu module trong yêu cầu ghi thư mục `tests/`; bộ tài liệu này chọn đặt cạnh file để nhất quán với code đã viết. e2e nằm ở `test/<module>.e2e-spec.ts`. Nếu bạn muốn `tests/` thì chỉ cần sửa quy ước này và `include` của vitest.

## 4. Controller / Service

- Controller **mỏng**: nhận DTO, gọi đúng một method service, trả kết quả đã map. Không `try/catch`, không Prisma, không `if` nghiệp vụ.
- Service ném `AppException` (xem [error-handling.md](../03-cross-cutting/error-handling.md)), không ném `HttpException` trực tiếp, không tự định dạng body lỗi.
- Không `any` trong chữ ký công khai. Dùng `Prisma.<Model>GetPayload<…>` hoặc type riêng.
- Mọi cập nhật nhiều bảng nằm trong `$transaction`; service nhận `tx?: Prisma.TransactionClient` khi có thể được gọi từ transaction của module khác.
- Mọi route mặc định cần JWT; route công khai phải ghi rõ `@Public()` và nêu lý do trong module doc.
- Mọi route có hạn chế vai trò dùng `@Roles(...)` lấy hằng số từ `src/auth/roles.constants.ts` (đề xuất) thay vì chuỗi rải rác.

## 5. Đơn vị, số lượng, tiền

1. **Số lượng tồn kho (`TonKho.soLuong`) luôn là đơn vị cơ bản** (đơn vị có `soLuongQuyDoi = 1`).
2. Dòng chi tiết phiếu lưu số lượng theo đơn vị người dùng nhập, kèm snapshot đơn vị và hệ số (đề xuất trường mới, xem [schema-notes.md](../01-data/schema-notes.md) §Đơn vị): `soLuongCoBan = soLuong × heSoQuyDoi`. Chỉ `soLuongCoBan` tác động tồn kho.
3. Số lượng là số nguyên dương (`Int`, ≥ 1) ở API; không có số lượng lẻ.
4. Tiền là `Decimal(15,2)`, **truyền qua API dạng chuỗi** `"125000.00"`; request chấp nhận chuỗi khớp `^\d{1,13}(\.\d{1,2})?$`. Tính toán bằng `Prisma.Decimal`, làm tròn `ROUND_HALF_UP` 2 chữ số **một lần ở cuối** mỗi phép tính thành tiền dòng.
5. `thanhTien` dòng = `soLuong × donGia` (theo cùng đơn vị). `tongTien` phiếu = Σ `thanhTien`. Không lưu `tongTien` ở phase 1 (tính khi đọc) — tránh lệch số liệu; xem [schema-notes.md](../01-data/schema-notes.md).
6. Tiền tệ duy nhất: VND. Không có trường tiền tệ.

## 6. Ngày giờ

- DB và API dùng **UTC, ISO 8601** (`2026-10-01T03:00:00.000Z`).
- Trường chỉ có ngày (`hanSuDung`, `ngaySX`, `ngayThanhToan`, `ngayCapGPKD`…): API nhận/trả `YYYY-MM-DD`; lưu là nửa đêm UTC của ngày đó (đề xuất đổi sang `@db.Date`, xem schema-notes).
- "Hôm nay" nghiệp vụ = ngày hiện tại theo `Asia/Ho_Chi_Minh`. Một lô có `hanSuDung = D` còn dùng được **hết ngày D**; hết hạn khi `D < hôm nay`.
- Mọi hàm đọc "hôm nay" đi qua một `ClockService` (đề xuất, `src/common/clock/`) để test điều khiển được thời gian. Cấm `new Date()` rải rác trong service nghiệp vụ.

## 7. Mã chứng từ

Sinh ở server, trong cùng transaction tạo bản ghi, bằng bảng `BoDemMa` (đề xuất).

| Đối tượng | Format | Ví dụ |
|---|---|---|
| `maPhieuNhapHang` | `PN` + `yyMMdd` + 4 số | `PN2610010001` |
| `maChiTietPhieuNhapHang` | `<maPhieu>-<nn>` | `PN2610010001-01` |
| `maPhieuXuatHang` | `PX` + `yyMMdd` + 4 số | `PX2610010001` |
| `maChiTietPhieuXuatHang` | `<maPhieu>-<nn>` | `PX2610010001-01` |
| `maPhieuThuCongNo` | `PT` + `yyMMdd` + 4 số | `PT2610010001` |
| `maPhieuThanhToan` | `TT` + `yyMMdd` + 4 số | `TT2610010001` |
| `maKH` | `KH` + 5 số | `KH00001` |
| `maNV` | `NV` + 4 số (đã dùng trong seed) | `NV0001` |
| `maSP` (đề xuất trường mới) | `SP` + 5 số | `SP00001` |
| `maNCC` (đề xuất trường mới) | `NCC` + 4 số | `NCC0001` |

Bộ đếm theo ngày reset mỗi ngày (theo giờ VN). Client không được tự gửi mã. Nếu doanh nghiệp đã có hệ thống mã cũ cần giữ: xem [open-questions.md](../open-questions.md).

## 8. Xóa và vô hiệu hóa

| Loại dữ liệu | Chính sách |
|---|---|
| Chứng từ (phiếu nhập/xuất/thu/thanh toán) | **Không bao giờ xóa** sau khi xác nhận; hủy bằng trạng thái `da_huy`. Phiếu nháp có thể xóa cứng |
| Danh mục (loại hàng, hàng hóa, kho, vị trí, khách, NCC, phương tiện, tỷ lệ quy đổi, số lô) | `DELETE` chỉ thành công khi **chưa có tham chiếu**, ngược lại `409 *_IN_USE`; muốn ngừng dùng thì đặt `trangThai` ngừng hoạt động |
| `User`, `Role` | Không xóa; vô hiệu hóa bằng `trangThai = false` |
| Tồn kho, sổ biến động, nhật ký | Không xóa, không sửa tay |

Chi tiết: [schema-notes.md](../01-data/schema-notes.md) §Xóa.

## 9. Trạng thái

Trạng thái là chuỗi snake_case không dấu, tập giá trị cố định theo module (liệt kê trong module doc). Đề xuất chuyển sang `enum` Prisma ở schema-notes; đến khi đó, hằng số trạng thái khai báo trong `src/<module>/<module>.constants.ts` và DTO dùng `@IsIn(Object.values(...))`.

## 10. Log

JSON qua pino, mỗi dòng có `requestId`, `userId` (nếu có), `method`, `url`, `statusCode`, `responseTime`. Không log mật khẩu, token, body đăng nhập, SĐT/MST/địa chỉ khách (PII). Chi tiết: [logging.md](../03-cross-cutting/logging.md).

## 11. Git và review

- Một commit cho một đơn vị logic; message `type(scope): subject` tiếng Anh. Co-author theo cấu hình repo.
- Mỗi PR/module phải kèm: code, unit test, e2e, cập nhật `docs/06-api/endpoints-catalog.md` và module doc nếu hành vi đổi.
- Không commit `.env`, `.env.test`, `yarn.lock` (đang bị bỏ qua).
- Trước khi coi một module "xong": `prisma validate`, `yarn lint`, `yarn test`, `yarn test:e2e`, `yarn build` đều xanh.
