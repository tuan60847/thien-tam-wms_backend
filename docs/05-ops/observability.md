# Quan sát hệ thống (observability)

Phạm vi phase 1 gọn có chủ đích: log có cấu trúc, health check, theo dõi thời gian xử lý. Chưa có metrics Prometheus, tracing phân tán, hay APM — chưa có bằng chứng cần và hạ tầng chia sẻ có thể không hỗ trợ.

## 1. Health check

`GET /api/v1/health` — `@Public()`, không đăng nhập, dùng `@nestjs/terminus`.

| Kiểm tra | Cách | Mục đích |
|---|---|---|
| `database` | `SELECT 1` qua Prisma, timeout 2 giây | DB sống |
| `memory_heap` | heap < 400 MB (cấu hình) | cảnh báo rò bộ nhớ |
| `jobs` (đề xuất) | thời điểm chạy gần nhất của từng job nền không quá cũ (> 36 giờ) | job còn chạy |

Phản hồi:

```json
{ "status": "ok", "info": { "database": { "status": "up" } }, "details": { … }, "version": "0.0.1", "uptime": 12345 }
```

- `200` khi tất cả `up`; `503` khi bất kỳ kiểm tra nào `down`.
- Không lộ chi tiết nhạy cảm (chuỗi kết nối, tên bảng). Chỉ `version` (từ `package.json`) và `uptime`.
- `GET /api/v1/health/live` (chỉ trả `200` nếu tiến trình sống, không chạm DB) dùng cho giám sát tiến trình; `/health` dùng cho kiểm tra sẵn sàng (sau deploy).
- Không ghi log mỗi lần gọi health ([logging.md](../03-cross-cutting/logging.md)).

## 2. Log

- Định dạng, trường, mức, che dữ liệu nhạy cảm: [logging.md](../03-cross-cutting/logging.md).
- Nơi lưu: stdout → PM2 → `./logs/out.log` và `./logs/error.log` ([deployment.md](deployment.md) §4). Xoay vòng bằng `pm2-logrotate` (14 ngày, nén) **[GIẢ ĐỊNH: cài được]** hoặc `logrotate` của hosting.
- Tìm lỗi theo `requestId`: người dùng báo mã từ body lỗi → `grep <requestId> logs/*.log`.
- Truy vấn log JSON: `jq 'select(.level>=50)' logs/out.log` (lỗi trở lên); `jq 'select(.event=="phieu_xuat.stock_out")'` (sự kiện nghiệp vụ).

## 3. Sự kiện nghiệp vụ đáng theo dõi

Đã có trong log (cấu trúc `event`): chuyển trạng thái chứng từ, thay đổi tồn, thao tác nhạy cảm, chạy job, đăng nhập thất bại. Sổ cái nghiệp vụ nằm trong DB (`BienDongTonKho`, `NhatKyHeThong`) — là nguồn truy vết chính, log chỉ bổ trợ.

## 4. Cảnh báo (thủ công, phase 1)

Chưa có hệ thống cảnh báo tự động. Đề xuất kiểm tra định kỳ (kịch bản cron ngoài hoặc người trực):

| Điều kiện | Cách phát hiện | Hành động |
|---|---|---|
| App chết | giám sát gọi `/health/live` mỗi phút (dịch vụ ping ngoài hoặc cron `curl`) | khởi động lại PM2, xem `error.log` |
| DB không kết nối | `/health` 503 | kiểm DB/hosting |
| Tồn không khớp sổ | log `error` từ job `stock-reconcile` (`soDongLech > 0`) | điều tra ngay — đây là lỗi toàn vẹn dữ liệu |
| Job không chạy | `/health` `jobs` down | xem log job, kiểm `JOBS_ENABLED` |
| Tăng đột biến 5xx | `jq 'select(.res.statusCode>=500)'` đếm theo giờ | xem `INTERNAL_ERROR` kèm stack |
| Disk log đầy | kiểm dung lượng thư mục `logs/` | giảm giữ log |

Nếu chốt dùng `@nestjs/observe` (hiện chỉ cắm với key placeholder), có thể thay các mục tự theo dõi trên; cần quyết định ([open-questions.md](../open-questions.md)).

## 5. Metrics (hoãn)

Có thể thêm `/metrics` (Prometheus) khi có hạ tầng thu thập. Số liệu hữu ích: số request và độ trễ theo route, số lỗi 5xx, thời gian truy vấn Prisma, số giao dịch bị `COMMON_CONCURRENT_UPDATE`, thời lượng job. Chưa làm ở phase 1.

## 6. Hiệu năng truy vấn

- Bật log truy vấn chậm: Prisma query event khi `LOG_LEVEL=debug`, lọc `duration > 500ms`.
- Báo cáo ghi thời gian chạy mỗi lần ([bao-cao.md](../02-modules/bao-cao.md) §9) để phát hiện suy giảm.
- Kiểm tra index khi báo cáo > 3 giây ([schema-notes.md](../01-data/schema-notes.md) §5).

## 7. Kiểm thử

- e2e: `/health` 200 khi DB sống, 503 khi giả lập DB down (override provider kiểm tra); `/health` truy cập được không cần token; header `x-request-id` luôn có.
- Unit: indicator job (`lastRunAt` quá cũ ⇒ down).
