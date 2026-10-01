# Chính sách migration

Công cụ: Prisma Migrate (Prisma 7, cấu hình ở `prisma.config.ts`, thư mục `prisma/migrations/`). MySQL 8.

## 1. Quy tắc đặt tên

`prisma migrate dev --name <verb>_<subject>` — snake_case, động từ + đối tượng, mô tả **thay đổi** chứ không mô tả ticket.

| Tốt | Không tốt |
|---|---|
| `add_audit_fields` | `update1`, `fix`, `m0` |
| `add_bien_dong_ton_kho` | `new_table` |
| `rename_phieu_nhap_create_at` | `change_columns` |
| `convert_status_columns_to_enum` | `enums` |

Tên thư mục tự có tiền tố timestamp UTC do Prisma sinh. Không đổi tên thư mục migration đã commit.

## 2. Nguyên tắc

1. **Một mối quan tâm cho mỗi migration.** Thêm bảng mới và sửa bảng cũ không liên quan thì tách.
2. **Không sửa migration đã áp dụng** ở bất kỳ DB nào ngoài máy bạn (đã push = coi như đã áp dụng). Muốn đổi: tạo migration mới.
3. **Đọc SQL do Prisma sinh trước khi commit.** Đặc biệt các thao tác phá hủy (`DROP COLUMN`, `DROP TABLE`, đổi kiểu cột).
4. **Phần Prisma không biểu diễn được** (CHECK constraint, `RENAME COLUMN`, backfill dữ liệu) thêm bằng SQL thô vào cùng file migration, có comment giải thích. Tạo bằng `prisma migrate dev --create-only` rồi sửa tay.
5. **Backfill dữ liệu nằm trong migration** nếu nhỏ và deterministic; nếu lớn/phức tạp, viết script riêng và chạy có kiểm soát.
6. `migrate dev` chỉ dùng ở máy dev. CI/staging/production chỉ dùng `prisma migrate deploy`. **Cấm** `migrate reset` và `db push` ngoài máy dev.
7. Sau khi đổi schema luôn `prisma generate` (client được cập nhật) và chạy lại toàn bộ test.
8. Mọi migration phải chạy sạch trên DB rỗng (e2e dựa vào điều này qua `migrate deploy` trong `beforeAll`).

## 3. Squash

- Hiện chỉ có migration `20261001043058_add_auth`, đồng thời là migration khởi tạo toàn bộ 19 bảng (do repo chưa có migration trước đó).
- **Được phép squash/đổi tên** khi chưa có database nào ngoài máy dev (chưa deploy staging/production): xóa thư mục `prisma/migrations`, tạo lại `init`. Đề xuất làm **một lần** ngay trước lần deploy đầu tiên, sau khi M0 xong và schema đã ổn định.
- **Sau lần deploy đầu tiên**: không squash; migration chỉ tăng. Nếu thư mục quá dài, squash chỉ khi tạo baseline mới cho môi trường mới và dùng `prisma migrate resolve --applied` cho môi trường cũ — thủ tục này cần thỏa thuận trước, không làm ad hoc.

## 4. Quy tắc zero-downtime (expand → migrate → contract)

Ứng dụng chạy PM2; khoảng thời gian code cũ và schema mới (hoặc ngược lại) cùng tồn tại là có thật. Mọi migration phải **tương thích ngược** với code đang chạy.

| Thay đổi | Cách làm an toàn |
|---|---|
| Thêm cột nullable | An toàn, một bước |
| Thêm cột NOT NULL | Hai bước: (1) thêm nullable/có `DEFAULT`, deploy code ghi cột mới, backfill; (2) migration sau đặt NOT NULL |
| Đổi tên cột/bảng | Prisma sinh drop+create ⇒ **không dùng**; sửa tay thành `ALTER TABLE … RENAME COLUMN`. Nếu code cũ vẫn chạy: thêm cột mới, ghi cả hai, chuyển đọc, bỏ cột cũ ở migration sau |
| Xóa cột | Deploy code ngừng dùng cột trước; xóa cột ở migration sau |
| Đổi `String` sang `enum` | Kiểm tra trước không có giá trị ngoài tập hợp (`SELECT DISTINCT`); đổi kiểu cột; code cũ ghi giá trị hợp lệ vẫn chạy |
| Thêm giá trị vào enum | `ALTER TABLE … MODIFY` thêm giá trị ở **cuối** danh sách (không đổi thứ tự) |
| Thêm UNIQUE/INDEX trên bảng lớn | Kiểm tra trùng lặp trước; MySQL 8 tạo index online (`ALGORITHM=INPLACE, LOCK=NONE`); với bảng lớn viết tay để chỉ định |
| Thêm CHECK constraint | Kiểm tra dữ liệu hiện có thỏa trước, rồi `ADD CONSTRAINT` |
| Thêm FK | Dữ liệu hiện có phải thỏa; thêm cột nullable trước, backfill, rồi thêm FK |

Ở quy mô ứng dụng này (một công ty, bảng chứng từ ở mức hàng chục nghìn dòng/năm) khóa bảng ngắn là chấp nhận được, nhưng vẫn giữ quy tắc tương thích ngược để không để phiên bản code lẫn schema ở trạng thái hỏng. Nếu hosting không cho chạy deploy không gián đoạn, bù bằng thông báo cửa sổ bảo trì (xem [deployment.md](../05-ops/deployment.md)).

## 5. Quy trình cho một thay đổi schema

1. Sửa `schema.prisma`.
2. `prisma migrate dev --name <verb>_<subject> --create-only`.
3. Đọc/sửa SQL; thêm backfill/CHECK nếu cần.
4. `prisma migrate dev` để áp dụng + `prisma generate`.
5. Cập nhật code, test, và [schema-notes.md](schema-notes.md) (đánh dấu mã `P-xx` đã áp dụng).
6. `yarn test && yarn test:e2e`.
7. Commit schema + migration + code cùng một PR.

## 6. Backup & khôi phục

- Trước **mỗi** lần `migrate deploy` ở production: dump database (`mysqldump --single-transaction`), lưu có ngày giờ và mã commit. Nơi lưu và lịch backup định kỳ: câu hỏi mở (phụ thuộc hosting).
- Prisma không có "down migration". Khôi phục = (a) migration sửa tiến (forward-fix) nếu lỗi nhỏ; (b) restore từ dump nếu hỏng dữ liệu.
- Cần kiểm tra định kỳ rằng dump restore được vào một DB trống.

## 7. DB test

`prisma migrate deploy` chạy trong `beforeAll` của e2e (đã làm ở `test/helpers/test-db.ts`). Tên DB test phải kết thúc `_test`; helper từ chối chạy nếu không.

## 8. Checklist PR có migration

- [ ] Tên migration đúng quy ước
- [ ] SQL đã đọc, không có thao tác phá hủy ngoài ý muốn
- [ ] Tương thích ngược với code đang chạy (hoặc đã ghi rõ thứ tự deploy)
- [ ] Chạy sạch trên DB rỗng và trên bản sao DB hiện có
- [ ] `schema-notes.md` cập nhật
- [ ] Test unit + e2e xanh
