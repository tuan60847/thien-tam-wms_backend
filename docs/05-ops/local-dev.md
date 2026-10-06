# Chạy local (dev)

## 1. Yêu cầu

| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | 24.x | máy dev hiện dùng v24; phiên bản trên hosting xem [deployment.md](deployment.md) |
| Yarn | 1.22.x | repo dùng yarn; `yarn.lock` hiện không được git theo dõi (xem §7) |
| MySQL | 8.x | chạy local; user có quyền tạo DB và **shadow database** (`prisma migrate dev`) |

## 2. Lần đầu

```bash
cp .env.example .env                 # chỉnh DATABASE_URL và hai JWT secret (≥ 32 ký tự, khác nhau)
cp .env.test.example .env.test       # DATABASE_URL trỏ tới DB tên kết thúc _test
yarn install

# tạo hai database (một lần)
mysql -uroot -e "CREATE DATABASE IF NOT EXISTS thienTamWMS CHARACTER SET utf8mb4; \
                 CREATE DATABASE IF NOT EXISTS thienTamWMS_test CHARACTER SET utf8mb4;"

npx prisma migrate dev               # áp dụng migration + prisma generate
npx prisma db seed                   # 4 role + user admin / Admin@123
yarn start:dev                       # http://localhost:3000
```

Sau M0 các địa chỉ đổi: API tại `http://localhost:3000/api/v1`, Swagger tại `/api/docs`, health tại `/api/v1/health`.

Kiểm tra nhanh:

```bash
curl -s -X POST localhost:3000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"username":"admin","password":"Admin@123"}'
```

## 3. Dữ liệu demo

```bash
yarn seed:demo        # (đề xuất, sau M2–M5) danh mục + đối tác + vài chứng từ mẫu, từ chối chạy khi NODE_ENV=production
```
Chi tiết dữ liệu: [seed-strategy.md](../01-data/seed-strategy.md).

## 4. Reset DB dev

```bash
npx prisma migrate reset             # XÓA SẠCH DB dev, chạy lại migration, tự chạy seed nền
yarn seed:demo                       # nếu cần dữ liệu demo
```
Chỉ trên máy dev. Cấm chạy ở bất kỳ môi trường dùng chung nào ([migrations-policy.md](../01-data/migrations-policy.md)).

## 5. Lệnh thường dùng

| Việc | Lệnh |
|---|---|
| Chạy dev (watch) | `yarn start:dev` |
| Build | `yarn build` |
| Chạy bản build | `yarn start:prod` |
| Lint | `yarn lint` |
| Format | `yarn format` |
| Unit test | `yarn test` (`yarn test:watch`, `yarn test:cov`) |
| E2E test | `yarn test:e2e` |
| Validate schema | `npx prisma validate` |
| Tạo migration | `npx prisma migrate dev --name <verb>_<subject>` |
| Xem DB | `npx prisma studio` |
| Sinh lại client | `npx prisma generate` |

## 6. Sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `Thiếu biến môi trường JWT_ACCESS_SECRET` / secret ngắn / trùng | Sửa `.env`; mỗi secret ≥ 32 ký tự và khác nhau |
| `P1001 Can't reach database` | MySQL chưa chạy hoặc `DATABASE_URL` sai (máy dev có thể dùng `root` không mật khẩu: `mysql://root@localhost:3306/thienTamWMS`) |
| `prisma migrate dev` đòi shadow database | User DB cần quyền `CREATE`; hoặc cấu hình shadow DB riêng trong `prisma.config.ts` |
| `Cannot find module '...'` sau khi pull | Chạy `yarn install` và `npx prisma generate` |
| Import lỗi `ERR_MODULE_NOT_FOUND` | Thiếu đuôi `.js` ở import tương đối (ESM) |
| `Tablespace for table ... exists. Please DISCARD the tablespace before IMPORT`, `Table ... doesn't exist in engine`, `_prisma_migrations already exists` dù database vừa tạo lại (thường gặp với XAMPP/MariaDB sau khi xóa thư mục dữ liệu hoặc `ibdata1` lệch với các file `.ibd`) | Từ điển nội bộ của InnoDB (`ibdata1`) còn mục ma của database cũ. Cách nhanh và an toàn: **dùng tên database mới** (ví dụ `thienTamWMS_v2` và `thienTamWMS_v2_test`) và sửa `DATABASE_URL` trong `.env`, `.env.test`. Chỉ khi cần dọn hẳn mới Stop MySQL rồi dời `ibdata1`, `ib_logfile*` đi — việc này xóa mọi bảng InnoDB của XAMPP |
| `Column count of mysql.proc is wrong` | Chạy `sudo /Applications/XAMPP/xamppfiles/bin/mysql_upgrade -u root --force` rồi restart MySQL |
| e2e từ chối chạy: "DATABASE_URL không trỏ tới DB test" | `.env.test` phải trỏ DB tên kết thúc `_test` |
| Cài `prisma` kéo bản rc không khớp client | Ghim `prisma` cùng phiên bản `@prisma/client` (hiện `^7.10.0`) |

## 7. Lưu ý về `yarn.lock`

`yarn.lock` đã bị gỡ khỏi git và nằm trong `.gitignore`. Hệ quả: mỗi máy/CI cài ra có thể khác phiên bản gói phụ thuộc gián tiếp. Với một backend triển khai lên production, **khuyến nghị theo dõi lại lockfile** để bản build tái lập được; xem câu hỏi mở và [deployment.md](deployment.md).

## 8. Kiểm tra trước khi push

```bash
npx prisma validate && yarn lint && npx tsc --noEmit && yarn test && yarn test:e2e && yarn build
```
