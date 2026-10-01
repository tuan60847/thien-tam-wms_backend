# Validation

Ba tầng, mỗi tầng một việc:

| Tầng | Công cụ | Kiểm tra gì | Lỗi trả về |
|---|---|---|---|
| 1. Cú pháp / hình dạng | DTO + `class-validator` + `ValidationPipe` | kiểu, bắt buộc, độ dài, regex, khoảng giá trị | `400 VALIDATION_FAILED` |
| 2. Quy tắc nghiệp vụ không cần DB | validator tùy biến hoặc hàm thuần trong service | quan hệ giữa các field trong cùng request | `422 <MODULE>_<REASON>` |
| 3. Quy tắc nghiệp vụ cần DB / trạng thái | service | tồn tại, trùng, trạng thái hợp lệ, đủ tồn | `404`, `409`, `422` |

DTO **không** truy vấn DB (không async validator gọi Prisma). Mọi kiểm tra cần DB nằm trong service để nằm trong transaction khi cần và dễ unit test.

## 1. Cấu hình ValidationPipe (đã có trong `main.ts`, bổ sung)

```
whitelist: true
forbidNonWhitelisted: true
transform: true                      # đề xuất bật: ép kiểu query/param (page, pageSize)
transformOptions: { enableImplicitConversion: false }
stopAtFirstError: false
exceptionFactory: → AppException VALIDATION_FAILED với details[]
```

`enableImplicitConversion` tắt có chủ đích: chuyển kiểu phải tường minh bằng `@Type(() => Number)` để không dính cạm bẫy ép kiểu ngầm (ví dụ chuỗi `"false"` thành `true`).

Body validation lỗi trả `details`: `[{ field: 'hanSuDung', messages: ['…'] }]` (xem [error-handling.md](error-handling.md)).

## 2. Quy ước DTO

1. DTO là `class`, một file mỗi DTO, đặt trong `dto/`.
2. Tên: `Create<X>Dto`, `Update<X>Dto = PartialType(Create<X>Dto)` (hoặc `OmitType` khi có field không cho sửa), `Query<X>Dto extends PaginationQueryDto`, `<X>ResponseDto`.
3. Mỗi field có **ít nhất** một decorator kiểu (`@IsString`, `@IsInt`, `@IsUUID`…); không có field "trần" (sẽ bị `whitelist` xóa mất).
4. Chuỗi: `@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)` rồi `@IsNotEmpty()`, `@MaxLength(n)`. Dùng decorator tái sử dụng `@TrimmedString()` (đề xuất, `src/common/decorators/`).
5. Chuỗi rỗng ở trường tùy chọn: coi là "không gửi" → `@IsOptional()` + transform `'' → undefined`.
6. Không có `any`; kiểu lồng nhau dùng `@ValidateNested()` + `@Type(() => X)`.
7. Response DTO là class thuần mô tả hình dạng (và dùng cho Swagger); mapper tạo ra nó. Không dùng `class-transformer` `@Exclude` để che field — che bằng mapper tường minh (an toàn hơn: field mới thêm vào model không tự lọt ra API).

## 3. Bộ validator dùng chung (đề xuất, `src/common/validators/`)

| Tên | Quy tắc | Dùng ở |
|---|---|---|
| `@IsMoney()` | chuỗi `^\d{1,13}(\.\d{1,2})?$`, ≥ 0 (cho phép `"0"`) | mọi trường tiền |
| `@IsPositiveMoney()` | như trên và > 0 | `soTien` phiếu thu/thanh toán |
| `@IsQuantity()` | số nguyên 1…2.000.000.000 (an toàn với `Int` MySQL) | `soLuong` |
| `@IsDateOnly()` | chuỗi `YYYY-MM-DD` hợp lệ theo lịch | `hanSuDung`, `ngaySX`, `ngayThanhToan`… |
| `@IsVnPhone()` | `^(0\d{9,10}|\+84\d{9})$` sau khi bỏ khoảng trắng/dấu chấm/gạch | SĐT |
| `@IsVnTaxCode()` | `^\d{10}(-\d{3})?$` | `maSoThue` |
| `@IsVehiclePlate()` | chuẩn hóa: bỏ khoảng trắng, `.`, `-`, in hoa, rồi khớp `^\d{2}[A-Z]{1,2}\d{4,6}$` | `bienSo` |
| `@IsStrongPassword()` | ≥ 8 ký tự, có chữ hoa, chữ thường, số; ≤ 72 byte (giới hạn bcrypt) | mật khẩu user |
| `@IsUsername()` | `^[a-z0-9._-]{3,32}$` (đã chuẩn hóa thường) | `username` |
| `@IsEnumValue(Enum)` | giá trị thuộc tập hằng số | trạng thái, enum |
| `@ArrayUniqueBy(key)` | không trùng phần tử theo key | dòng chi tiết |

Ghi chú: regex SĐT/MST/biển số là **mặc định hợp lý**, cần bạn xác nhận (câu hỏi mở) vì dữ liệu thật có thể có định dạng khác (số bàn, nhiều số...).

## 4. Kiểm tra nghiệp vụ không cần DB (tầng 2)

Viết thành hàm thuần trong `<module>.rules.ts`, unit test độc lập, service gọi chúng. Ví dụ:

- `assertPriceOrder(giaToiThieu, giaHienThi)` → `HANG_HOA_PRICE_INVALID`.
- `assertExpiryAfterManufacture(ngaySX, hanSuDung)` → `SO_LO_DATE_INVALID`.
- `computeLineTotal(soLuong, donGia)` → `Prisma.Decimal` (làm tròn 2 chữ số HALF_UP).
- `convertToBaseQuantity(soLuong, heSoQuyDoi)`.

## 5. Quy tắc dùng chung cho dòng chi tiết phiếu

Áp dụng cho `phieu-nhap-hang` và `phieu-xuat-hang`:

1. `chiTiet` là mảng, 1…200 phần tử (`@ArrayMinSize(1) @ArrayMaxSize(200)`).
2. Mỗi dòng: `soLuong` (`@IsQuantity`), `donGia` (`@IsMoney`), `donViTinh` (chuỗi), `viTriId` (UUID), và định danh lô (nhập: `soLoId` **hoặc** `soLo{…}`; xuất: `soLoId`).
3. Không trùng cặp `(soLoId, viTriId)` trong cùng phiếu (gộp ở client). Với nhập có `soLo{…}` mới: không trùng `(hangHoaId, tenLo, viTriId)`.
4. Tối đa một trong hai `soLoId` / `soLo` (`@ValidateIf` + kiểm tra XOR ở tầng 2).

## 6. Xử lý chuỗi nhạy cảm

- `username`, `email`: lưu **chữ thường** (chuẩn hóa ở DTO transform) để unique không phân biệt hoa/thường.
- Văn bản tự do (`ghiChu`, `lyDoHuy`): tối đa 500 ký tự (ghi chú) / 255 (lý do); không strip HTML (API trả JSON, client chịu trách nhiệm escape) nhưng không bao giờ nối vào SQL thô.
- Tất cả truy vấn thô (`$queryRaw`) phải dùng template tagged (tham số hóa), không nối chuỗi.

## 7. Kiểm thử validation

- Mỗi DTO có unit test bằng `validate(plainToInstance(Dto, payload))`: case hợp lệ, thiếu field, sai kiểu, vượt biên, chuỗi toàn khoảng trắng, field thừa (khi qua pipe).
- Validator dùng chung có test riêng với bảng case (hợp lệ/không hợp lệ).
- Mỗi module e2e có ít nhất 1 case `400 VALIDATION_FAILED` để chứng minh pipe + body lỗi chuẩn.
