# Logging

## 1. Công cụ

`nestjs-pino` (pino + pino-http), thay logger mặc định của Nest ở `main.ts` (`app.useLogger(app.get(Logger))`). Ghi **JSON một dòng mỗi sự kiện** ra stdout; PM2 gom stdout vào file log ([observability.md](../05-ops/observability.md)). Dev dùng `pino-pretty` (chỉ khi `NODE_ENV !== 'production'`).

## 2. Cấu hình

| Thiết lập | Giá trị |
|---|---|
| Mức log | `LOG_LEVEL` (`debug` dev, `info` production); mặc định `info` |
| `genReqId` | lấy `x-request-id` hợp lệ hoặc sinh UUID; gắn vào mọi dòng log của request và vào body lỗi |
| `customProps` | `userId`, `maRole` (nếu đã xác thực) |
| `autoLogging.ignore` | `GET /api/v1/health` |
| `serializers.req` | chỉ `id`, `method`, `url` (không header, không body) |
| `serializers.res` | chỉ `statusCode` |
| `redact` | xem §4 |
| `customLogLevel` | 5xx → `error`; 4xx → `warn`; còn lại `info` |

## 3. Log gì

| Loại | Mức | Nội dung |
|---|---|---|
| Request hoàn tất | info/warn/error | `requestId`, `method`, `url` (không query nhạy cảm), `statusCode`, `responseTime`, `userId` |
| Lỗi không lường trước (500) | error | stack, `requestId`, route; không body request |
| Chuyển trạng thái chứng từ | info | `event`, `maPhieu`, `from`, `to`, `userId` — ví dụ `phieu_nhap.confirmed` |
| Thay đổi tồn kho | info | `event: 'stock.changed'`, `soLoId`, `viTriId`, `loai`, `soLuongThayDoi`, `thamChieu` (song song với `BienDongTonKho` — log không thay thế sổ) |
| Thao tác nhạy cảm (hủy, điều chỉnh, đổi role, khóa user, bán dưới giá tối thiểu) | warn | `event`, đối tượng, `userId`, `lyDo` — song song với `NhatKyHeThong` |
| Job nền | info | bắt đầu / kết thúc / số bản ghi xử lý / thời gian; lỗi → error |
| Đăng nhập thất bại | warn | `username` (băm hoặc cắt, xem §4), `ip`, lý do mã `AUTH_*`; **không** log mật khẩu |
| Lỗi gọi dịch vụ ngoài (Cloudinary) | error | mã lỗi nhà cung cấp, không log nội dung file |
| Khởi động / tắt | info | phiên bản, `NODE_ENV`, port, kết nối DB OK |

Không log: từng truy vấn Prisma ở production (bật `query` event chỉ khi `LOG_LEVEL=debug`), nội dung response, danh sách đầy đủ dòng chi tiết phiếu.

## 4. Dữ liệu nhạy cảm (PII) và bí mật

**Cấm tuyệt đối xuất hiện trong log:** `password`, `accessToken`, `refreshToken`, `tokenHash`, mọi `*Secret`, `Authorization` header, cookie, `DATABASE_URL`.

**Hạn chế (chỉ log khi thật cần, ở mức debug, hoặc che):**

| Dữ liệu | Quy tắc |
|---|---|
| `email`, `SDT`, `SDTNDD`, `sdtNguoiPT` | che: giữ 3 ký tự cuối (`******789`) |
| `maSoThue`, `soGiayPhepKinhDoanh`, `soGCNDuDieuKienKinhDoanhDuoc` | không log |
| `diaChi`, `diaChiGiaoHang`, `nguoiDaiDien` | không log |
| `username` | cho phép (định danh nội bộ), nhưng không kèm lý do cụ thể "sai mật khẩu" hay "không tồn tại" ở cấp log client-facing |
| `userId`, `maNV` | cho phép |

`pino` `redact.paths` (đề xuất): `req.headers.authorization`, `req.headers.cookie`, `*.password`, `*.accessToken`, `*.refreshToken`, `*.tokenHash`, `*.email`, `*.SDT`, `*.maSoThue`, `res.headers["set-cookie"]`. Redact dựa trên tên field là lớp phòng thủ thứ hai; lớp thứ nhất là **không đưa object nhạy cảm vào log**.

Quy tắc code: không `logger.log(entity)` / `logger.log(dto)` cả object; chỉ log các field đã chọn.

## 5. Quy ước sự kiện

Log nghiệp vụ dùng trường `event` dạng `<domain>.<verb>` để lọc: `phieu_nhap.confirmed`, `phieu_nhap.cancelled`, `phieu_xuat.stock_out`, `phieu_xuat.delivered`, `phieu_xuat.cancelled`, `stock.adjusted`, `stock.transferred`, `phieu_thu.created`, `phieu_thu.voided`, `user.locked`, `auth.login_failed`, `job.expiry_scan.done`.

## 6. Giữ log

- Xoay vòng log: `pm2-logrotate` hoặc `logrotate` của hosting (xem câu hỏi mở về hạ tầng); mặc định giữ 14 ngày, nén.
- Log chứa `requestId` khớp với body lỗi để hỗ trợ truy vết ("gửi mã `requestId` cho kỹ thuật").

## 7. Kiểm thử

- Unit test: serializer/redact không làm lọt `password`/token (cấp cho một object chứa các field đó, kiểm đầu ra).
- e2e: response có header `x-request-id`; body lỗi có `requestId` trùng header.
- Kiểm tra rà soát (checklist PR): không có `console.log`, không log object nguyên khối.
