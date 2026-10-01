# Unit test — quy ước

Công cụ: Vitest ^4 (`globals: true`), `vitest-mock-extended`, không plugin SWC (decorator metadata đã hoạt động). Cấu hình `vitest.config.ts` (`include: ['**/*.spec.ts']`). Test đặt **cạnh** file nguồn (`x.service.ts` ↔ `x.service.spec.ts`).

## 1. Cấu trúc file

```ts
describe('PhieuNhapHangService', () => {
  // dựng SUT + collaborators ở beforeEach
  describe('confirm', () => {
    it('chuyển sang da_nhap_kho và tăng tồn từng dòng', async () => {…});
    it('ném PHIEU_NHAP_INVALID_STATE khi phiếu đã xác nhận', async () => {…});
  });
});
```

- Một `describe` mỗi class, một `describe` lồng mỗi method công khai.
- Tên `it` bằng **tiếng Việt**, mô tả hành vi theo mẫu trong module doc: `method() — <điều kiện> → <kết quả>`. Viết thành câu: "xác nhận phiếu rỗng → ném PHIEU_NHAP_EMPTY".
- Mỗi `it` kiểm **một** hành vi; nhiều `expect` chỉ khi cùng mô tả một kết quả.
- Mẫu AAA (arrange – act – assert) ngăn bởi dòng trống.
- Không dùng `any`; stub có kiểu qua `mock<T>()`.

## 2. Mock Prisma

Có ba mức, chọn **mức thấp nhất đủ dùng**:

| Mức | Dùng khi | Cách |
|---|---|---|
| 1. Hàm thuần | `*.rules.ts`, mapper | không mock |
| 2. Collaborator giả | service gọi service khác (`TonKhoService`, `SoLoService`, `AuditService`…) | `mock<TonKhoService>()` rồi `mockResolvedValue`; kiểm `toHaveBeenCalledWith` |
| 3. Prisma giả trong bộ nhớ | service cần ngữ nghĩa thật của vài thao tác (`updateMany` có điều kiện, `$transaction`) | stub tự viết như `createFakePrisma()` trong `src/auth/auth.service.spec.ts` |

Quy tắc:
- **Không** `mockDeep<PrismaService>()` rồi mock từng truy vấn của một service nhiều bảng — test vô nghĩa và giòn. Dùng mức 3 cho các service chứng từ/tồn kho; truy vấn tổng hợp để e2e.
- `$transaction` trong stub: `async (fn) => fn(fakeTx)` với `fakeTx` là cùng đối tượng stub; thêm bản `rollback` giả lập (chụp trạng thái trước, khôi phục khi `fn` ném) để unit test được "lỗi giữa chừng thì không để lại gì".
- `Prisma.Decimal` dùng thật (không mock).
- Chỉ stub các method service thật sự gọi; method lạ gọi vào sẽ ném lỗi rõ ràng (stub chặt) để phát hiện phụ thuộc ngoài ý muốn.

## 3. Thời gian và sinh mã

- `ClockService` giả: `{ today(): Date; now(): Date }`; mỗi test đặt ngày cố định; helper `clockAt('2026-10-01')`.
- `CodeGeneratorService` giả trả chuỗi tăng dần `PN2610010001`…; có test riêng cho chính `CodeGeneratorService` (reset theo ngày VN, tăng nguyên tử).
- Không dùng `vi.useFakeTimers()` cho logic nghiệp vụ ngày (dùng `ClockService`); chỉ dùng cho debounce/timeout kỹ thuật.
- `randomUUID` không cần giả; so sánh theo `expect.any(String)`.

## 4. Factory dữ liệu

`src/testing/factories.ts` (đề xuất, chỉ dùng trong test, loại khỏi build qua `tsconfig.build.json`):

```ts
makeUser({ role: 'NHAN_VIEN_KHO' })        → AuthenticatedUser
makeHangHoa({ isCanGiuLanh: true })        → HangHoa (+ đơn vị viên/vỉ/hộp)
makeSoLo({ hanSuDung: daysFromToday(45) }) → SoLo
makeViTri({ isCapDong: true })             → ViTri
makeTonKho({ soLuong: 100 })               → TonKho
makeNhaCungCap({ verified: true })         → NhaCungCap
makeKhachHang({ giayPhep: 'het_han' })     → KhachHang
makePhieuNhap({ lines: [...] })            → PhieuNhapHang + dòng
makePhieuXuat({ lines: [...] })            → PhieuXuatHang + dòng
```

- Mọi factory có mặc định hợp lệ; test chỉ ghi đè thứ liên quan (để người đọc thấy cái gì quan trọng).
- Factory trả object thuần, không chạm DB (factory chạm DB nằm ở `test/helpers/` cho e2e).
- Tiền luôn là `Prisma.Decimal`/chuỗi, ngày dựng qua `daysFromToday(n)` dựa trên `ClockService` giả.

## 5. Kiểm thử từng loại thành phần

| Thành phần | Cách kiểm |
|---|---|
| `*.rules.ts` | bảng case `it.each([...])` gồm biên (0, âm, = ngưỡng, ±1) |
| Service | mức 2/3 ở §2; mỗi mã lỗi trong module doc có một case; mỗi BR có một case |
| Controller | chỉ kiểm **metadata**: `Reflect.getMetadata(ROLES_KEY, …)` đúng role, `@HttpCode`, `@Public`; không kiểm logic (không có) |
| DTO | `validate(plainToInstance(Dto, payload))`: hợp lệ, thiếu, sai kiểu, vượt biên, chuỗi toàn khoảng trắng; field thừa kiểm qua `ValidationPipe` |
| Validator dùng chung | `it.each` bảng hợp lệ/không hợp lệ |
| Mapper | không lộ field nhạy cảm; Decimal → chuỗi 2 chữ số; che theo role |
| Guard/Filter | như `roles.guard.spec.ts`, `jwt-auth.guard.spec.ts` hiện có; filter: mỗi loại exception → body chuẩn |
| Job | gọi service job với `ClockService` giả; không chạy cron thật |

## 6. Kiểm tra giao dịch/rollback ở unit

Với service ghi nhiều bước (xác nhận phiếu nhập, xuất kho, hủy):
- Test "lỗi ở bước k" bằng cách cho collaborator thứ k ném; assert **không còn thay đổi** trong stub Prisma (trạng thái phiếu, tồn) và collaborator sau bước k **không** được gọi.
- Test thứ tự gọi quan trọng (`toHaveBeenNthCalledWith`) chỉ khi thứ tự là yêu cầu nghiệp vụ.

## 7. Chống test giòn

- Không assert vào thông báo tiếng Việt đầy đủ trừ khi test chính message đó; assert vào `code`.
- Không assert vào thứ tự mảng khi thứ tự không phải yêu cầu.
- Không dùng snapshot cho dữ liệu nghiệp vụ.
- Không chia sẻ trạng thái giữa các `it` (dựng lại trong `beforeEach`).
- Test đặt tên theo hành vi, không theo tên hàm nội bộ.

## 8. Chạy

```
yarn test                 # toàn bộ unit
yarn test <đường-dẫn>     # một file
yarn test:watch
yarn test:cov             # coverage v8
```
