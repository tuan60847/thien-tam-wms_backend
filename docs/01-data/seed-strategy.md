# Chiến lược seed

## 1. Nguyên tắc

- Mọi seed **idempotent**: chạy lại bao nhiêu lần cũng ra cùng trạng thái, không ghi đè dữ liệu người dùng đã đổi (ví dụ mật khẩu).
- Tách ba tầng với mục đích khác nhau; không trộn dữ liệu demo vào seed nền.
- Seed không dùng service Nest (chạy bằng `tsx` ngoài ứng dụng) — dùng `PrismaClient` + adapter như `prisma/seed.ts` hiện tại.
- Seed bằng upsert theo khóa nghiệp vụ (`maRole`, `username`, `maSP`…), không bằng `id`.

## 2. Ba tầng

| Tầng | File | Chạy ở đâu | Nội dung |
|---|---|---|---|
| **Base** | `prisma/seed.ts` (đã có, sẽ mở rộng) | mọi môi trường, kể cả production | 4 role + user `admin` |
| **Demo** | `prisma/seed-demo.ts` (đề xuất) | dev, staging | danh mục + đối tác + vài chứng từ mẫu |
| **Test fixtures** | `test/helpers/*.ts` (factory) | chỉ trong e2e | dữ liệu tối thiểu cho từng test |

Lệnh đề xuất: `prisma db seed` (= Base, theo `prisma.config.ts`); `yarn seed:demo` (= Demo, đề xuất script `tsx prisma/seed-demo.ts`, từ chối chạy nếu `NODE_ENV=production`).

## 3. Base seed

### 3.1 Role (upsert theo `maRole`)

| `maRole` | `tenRole` | Ghi chú |
|---|---|---|
| `ADMIN` | Quản trị viên | đã có |
| `QUAN_LY_KHO` | Quản lý kho | **thêm mới** |
| `NHAN_VIEN_KHO` | Nhân viên kho | đã có |
| `KE_TOAN` | Kế toán | **thêm mới** |

### 3.2 Admin

- `maNV = NV0001`, `username = admin`, `hoTen = Quản trị viên`, gắn role `ADMIN`.
- Hiện mật khẩu mặc định cứng là `Admin@123`. Đề xuất cho production: đọc `SEED_ADMIN_PASSWORD` từ env; nếu `NODE_ENV=production` mà thiếu biến này → seed **dừng với lỗi** thay vì dùng mật khẩu mặc định. Dev/test vẫn dùng `Admin@123` khi không đặt biến.
- Lần chạy sau không đổi mật khẩu (đã đúng ở seed hiện tại). `BoDemMa` của `NV` được đồng bộ để user tạo qua API tiếp theo là `NV0002`.

## 4. Demo seed (dev / staging)

Mục tiêu: dev mở UI/Swagger lên là có dữ liệu để thao tác ngay, và dữ liệu đủ đa dạng để bộc lộ các quy tắc (cận date, kho lạnh, NCC chưa xác minh…).

| Nhóm | Dữ liệu |
|---|---|
| User | `quanly` (QUAN_LY_KHO), `nhanvien` (NHAN_VIEN_KHO), `ketoan` (KE_TOAN); mật khẩu demo `Demo@12345` |
| Loại hàng | Kháng sinh, Giảm đau – hạ sốt, Vitamin & khoáng chất, Vắc-xin & sinh phẩm |
| Hàng hóa | ~12 mặt hàng, trong đó: ≥ 2 thuốc kê đơn, ≥ 1 kiểm soát đặc biệt, ≥ 2 cần giữ lạnh (vắc-xin/insulin), mỗi hàng có đủ đơn vị viên/vỉ/hộp hoặc ống/hộp |
| Kho & vị trí | 2 kho; kho 1 có 4 vị trí thường + 1 vị trí cấp đông; kho 2 có 2 vị trí |
| NCC | 3: đã xác minh đủ giấy phép; chưa xác minh; từ chối |
| Khách hàng | 5 nhà thuốc: hoạt động đủ giấy phép; GPKD sắp hết hạn; GPKD đã hết hạn; ngừng hoạt động; không có MST |
| Phương tiện | 1 xe thường, 1 xe lạnh *(nếu P xe lạnh được chốt)* |
| Lô & tồn | Qua **luồng nghiệp vụ thật**: seed gọi trực tiếp Prisma theo đúng thứ tự của luồng xác nhận phiếu nhập để cộng tồn và ghi `BienDongTonKho`; bao gồm lô còn hạn dài, lô cận date, lô đã hết hạn còn tồn |
| Chứng từ | 2 phiếu nhập (1 đã nhập kho, 1 nháp), 3 phiếu xuất (nháp / đã xuất kho / đã giao), vài phiếu thu và thanh toán một phần |

Dữ liệu demo ngày tháng tính **tương đối so với hôm chạy** (ví dụ `hanSuDung = hôm nay + 45 ngày`) để cận date luôn đúng bất kể lúc nào seed.

Reset dev: `prisma migrate reset` (xóa sạch, chạy lại migration, tự chạy Base seed) rồi `yarn seed:demo`. Cấm trên staging/production.

## 5. Test

- e2e **không dùng** Base/Demo seed dùng chung. Mỗi file e2e dựng fixture bằng factory (`test/helpers/factories.ts`, đề xuất): `createRole()`, `createUser({ role })`, `createHangHoa()`, `createSoLo()`, `createTonKho()`, `createNhaCungCap({ verified: true })`…
- Reset giữa các test: xóa theo thứ tự phụ thuộc ngược (chứng từ → tồn/lô → danh mục → user), chỉ trên DB có tên kết thúc `_test` (kiểm tra bảo vệ đã có ở `test/helpers/test-db.ts`).
- Mật khẩu fixture băm với bcrypt cost thấp (4) cho nhanh.
- Role cần cho test phân quyền (4 role) tạo bởi factory, không phụ thuộc Base seed.

## 6. Staging

Base seed + Demo seed một lần khi dựng; dữ liệu staging có thể bị reset bất cứ lúc nào. Mật khẩu demo **không** được dùng trên staging nếu staging truy cập được từ Internet — đặt qua biến môi trường (câu hỏi mở: staging có tồn tại không).

## 7. Production

Chỉ Base seed. Import dữ liệu thật ban đầu (danh mục hàng, khách, NCC, tồn đầu kỳ) là **việc riêng**, ngoài phạm vi seed: cần script import có kiểm tra (CSV → validate → ghi qua service để sinh `BienDongTonKho`). Tồn đầu kỳ nhập bằng phiếu nhập "đầu kỳ" hay bằng điều chỉnh tồn là câu hỏi mở.
