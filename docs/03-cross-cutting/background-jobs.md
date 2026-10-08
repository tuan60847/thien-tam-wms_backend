# Job nền

## 1. Quyết định

**Phase 1 không dùng BullMQ/Redis.** Dùng `@nestjs/schedule` (cron trong tiến trình). Lý do:

1. Khối lượng job rất nhỏ (một vài lần mỗi ngày, xử lý vài nghìn dòng).
2. BullMQ đòi Redis; hosting dùng chung (`m3xs.net`, xem [deployment.md](../05-ops/deployment.md)) nhiều khả năng không cung cấp Redis — **giả định cần bạn xác nhận** (câu hỏi mở).
3. Mọi việc "tính toán theo thời gian" khác (tuổi nợ, trạng thái cận date khi đọc) được thiết kế để **tính khi đọc**, không cần job.

Nâng cấp lên BullMQ khi xuất hiện một trong: cần retry/backoff nhiều bước, cần gửi email/SMS hàng loạt, tác vụ nặng cần tách khỏi tiến trình API, nhiều instance cần điều phối. Khi đó job viết dưới dạng service thuần (xem §4) nên đổi cơ chế kích hoạt không phải viết lại nghiệp vụ.

## 2. Danh sách job

| Job | Lịch (giờ VN) | Mục đích | Milestone |
|---|---|---|---|
| `expiry-scan` | hằng ngày 01:00 | Cập nhật `SoLo.trangThai` (`con_han` / `can_date` / `het_han`) theo `hanSuDung` hôm nay và ngưỡng `EXPIRY_WARNING_DAYS` | M4 |
| `stock-reconcile` | hằng ngày 02:00 | Đối soát `TonKho.soLuong = Σ BienDongTonKho.soLuongThayDoi`; ghi log lỗi nếu lệch ([audit-trail.md](audit-trail.md) §5) | M4 |
| `refresh-token-cleanup` | hằng ngày 03:00 | Xóa `RefreshToken` đã hết hạn quá 30 ngày (giải quyết giới hạn đã biết của Auth) | M8 |
| `file-orphan-cleanup` | phase 2 | Xóa file trong `UPLOAD_DIR` không còn bản ghi DB | sau M7 |

Không có job gửi thông báo/email ở phase 1: cảnh báo cận date hiện hiển thị qua báo cáo ([bao-cao.md](../02-modules/bao-cao.md)).

### 2.1 `expiry-scan` chi tiết

- `today` = ngày hôm nay theo `Asia/Ho_Chi_Minh` (qua `ClockService`).
- Hai câu `UPDATE` theo lô, không lặp từng dòng:
  - `het_han` ⇐ `hanSuDung < today`
  - `can_date` ⇐ `today <= hanSuDung <= today + EXPIRY_WARNING_DAYS`
  - `con_han` ⇐ còn lại
  Chỉ cập nhật dòng thực sự đổi trạng thái (điều kiện `trangThai <> giá trị mới`).
- Ghi log `job.expiry_scan.done` với số lô đổi sang mỗi trạng thái.
- **Cột `trangThai` chỉ là bản lưu đệm để lọc nhanh.** Giá trị đúng tại thời điểm đọc luôn được tính lại từ `hanSuDung` trong mapper; nghiệp vụ chặn xuất lô hết hạn dựa vào `hanSuDung`, **không** dựa vào cột `trangThai`. Vì vậy job lỡ chạy không gây sai nghiệp vụ.
- Idempotent: chạy lại bao nhiêu lần cũng cùng kết quả.

## 3. Cấu hình

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `JOBS_ENABLED` | `true` | `false` để tắt toàn bộ job (dùng cho test/CLI) |
| `EXPIRY_WARNING_DAYS` | `90` | số ngày trước hạn tính là cận date (câu hỏi mở: con số đúng) |
| `JOBS_TIMEZONE` | `Asia/Ho_Chi_Minh` | múi giờ cron |

e2e đặt `JOBS_ENABLED=false` và gọi service job trực tiếp.

## 4. Cấu trúc

```
src/ton-kho/jobs/
  expiry-scan.job.ts          # @Cron wrapper mỏng, gọi service
  stock-reconcile.job.ts
src/so-lo/so-lo.service.ts    # refreshExpiryStatuses(today): Promise<{ canDate: number; hetHan: number }>
src/auth/auth.service.ts      # purgeExpiredRefreshTokens(before: Date): Promise<number>
```

Wrapper `@Cron` chỉ bọc: lấy khóa chạy, gọi service, log kết quả, bắt lỗi (không để lỗi job làm sập tiến trình). Nghiệp vụ nằm trong service để unit test không cần cron.

## 5. Chạy trên nhiều instance

PM2 chạy một instance (chế độ `fork`) theo giả định hosting hiện tại, nên không cần phối hợp. Nếu sau này chạy cluster/nhiều instance: dùng khóa MySQL `GET_LOCK('job:<tên>', 0)` ở đầu mỗi job để chỉ một instance chạy; instance không lấy được khóa bỏ qua im lặng. Cài sẵn helper `runExclusive(name, fn)` ngay từ đầu để chuyển đổi không đổi code job.

## 6. Giám sát

Mỗi job log bắt đầu/kết thúc, thời lượng, số bản ghi; lỗi → `error`. Health check có thể kèm `lastRunAt` của từng job (đề xuất, [observability.md](../05-ops/observability.md)).

## 7. Kiểm thử

- Unit: `refreshExpiryStatuses` với tập lô có hạn nằm trước/đúng ngày/trong cửa sổ/ngoài cửa sổ (kiểm biên `hanSuDung = today` ⇒ còn dùng được ⇒ `can_date`, không phải `het_han`), dùng `ClockService` giả; idempotent (chạy hai lần, kết quả như nhau, lần hai đổi 0 dòng).
- Unit: `purgeExpiredRefreshTokens` chỉ xóa token hết hạn quá ngưỡng, giữ token còn hiệu lực/mới hết hạn.
- Unit: `runExclusive` bỏ qua khi không lấy được khóa (mock).
- e2e: dựng lô ở nhiều mốc hạn, gọi service job, kiểm trạng thái trong DB và kết quả `GET /so-lo?trangThai=can_date`.
