# ThienTamWMS — Backend

Hệ thống quản lý kho thuốc cho nhà phân phối dược phẩm Thiên Tâm: nhập hàng, lưu kho theo lô và vị trí, xuất hàng cho nhà thuốc, truy vết lô, theo dõi hạn dùng và công nợ hai chiều.

Xây dựng bằng [NestJS](https://nestjs.com) 12 (ESM) + TypeScript + Prisma 7 + MySQL.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Framework | NestJS 12, chạy ESM (`import` nội bộ phải có đuôi `.js`) |
| Ngôn ngữ | TypeScript 6 |
| CSDL / ORM | MySQL (hoặc MariaDB) + Prisma 7 (adapter `@prisma/adapter-mariadb`) |
| Xác thực | JWT (access 15 phút, refresh 7 ngày có xoay vòng), Passport |
| Tài liệu API | Swagger (`@nestjs/swagger`) |
| Log | pino (`nestjs-pino`) |
| Kiểm thử | Vitest + Supertest |
| Lint / format | oxlint, prettier |

## Tiến độ

| Milestone | Nội dung | Trạng thái |
|---|---|---|
| M0 | Nền tảng chung: prefix `/api/v1`, lỗi chuẩn, phân trang, log, health, Swagger, sinh mã chứng từ, nhật ký thao tác | Xong |
| — | Auth: đăng nhập, refresh, đăng xuất, phân quyền theo role | Xong |
| M1 | Vai trò và người dùng | Xong |
| M2 | Loại hàng, hàng hóa, tỷ lệ quy đổi đơn vị | Xong |
| M3 | Kho và vị trí, khách hàng, nhà cung cấp, phương tiện vận chuyển | Xong |
| M4 | Số lô và tồn kho | Xong |
| M5 | Phiếu nhập hàng, thanh toán nhà cung cấp | Chưa làm |
| M6 | Phiếu xuất hàng, thu công nợ | Chưa làm |
| M7 | Báo cáo, tệp đính kèm | Chưa làm |

Kế hoạch chi tiết từng module, quy ước và các câu hỏi cần chốt nằm trong [docs/](docs/README.md).

## Yêu cầu

- Node.js 24
- Yarn 1.22 (repo dùng yarn; có thể thay bằng npm)
- MySQL 8 hoặc MariaDB 10.4+, user có quyền tạo database (Prisma cần tạo "shadow database" khi `migrate dev`)

## Chạy lần đầu

```bash
cp .env.example .env              # sửa DATABASE_URL và hai khóa JWT (mỗi khóa ≥ 32 ký tự, khác nhau)
cp .env.test.example .env.test    # DATABASE_URL trỏ tới database có tên kết thúc bằng _test
yarn install

# tạo hai database rỗng
mysql -uroot -e "CREATE DATABASE thienTamWMS CHARACTER SET utf8mb4; CREATE DATABASE thienTamWMS_test CHARACTER SET utf8mb4;"

npx prisma migrate dev            # tạo bảng và sinh Prisma client
npx prisma db seed                # tạo 4 vai trò và tài khoản quản trị
yarn start:dev                    # http://localhost:3000
```

Tài khoản quản trị mặc định (chỉ để dev): `admin` / `Admin@123`. Ở môi trường production phải đặt `SEED_ADMIN_PASSWORD` trước khi seed.

Thử đăng nhập:

```bash
curl -X POST localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"Admin@123"}'
```

## Địa chỉ hữu ích

| Địa chỉ | Mô tả |
|---|---|
| `http://localhost:3000/api/v1` | Gốc của API (mọi route đều nằm dưới `/api/v1`) |
| `http://localhost:3000/api/docs` | Swagger UI (bật mặc định ở dev, tắt ở production) |
| `http://localhost:3000/api/v1/health` | Kiểm tra sẵn sàng (DB, bộ nhớ) |

## Lệnh thường dùng

| Việc | Lệnh |
|---|---|
| Chạy dev (tự nạp lại khi sửa code) | `yarn start:dev` |
| Build | `yarn build` |
| Chạy bản build (production) | `yarn start:prod` |
| Unit test | `yarn test` |
| E2E test (cần MySQL và `.env.test`) | `yarn test:e2e` |
| Độ phủ test | `yarn test:cov` |
| Lint | `yarn lint` |
| Định dạng code | `yarn format` |
| Kiểm tra schema | `npx prisma validate` |
| Tạo migration | `npx prisma migrate dev --name <động_từ>_<đối_tượng>` |
| Xem dữ liệu | `npx prisma studio` |

Trước khi push nên chạy đủ:

```bash
npx prisma validate && yarn lint && npx tsc --noEmit && yarn test && yarn test:e2e && yarn build
```

Test e2e chạy trên database `*_test`, tự áp dụng migration rồi xóa và nạp lại dữ liệu mỗi lần; chương trình từ chối chạy nếu tên database không kết thúc bằng `_test`, nên không thể xóa nhầm dữ liệu thật.

## Biến môi trường

| Tên | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | Có | Chuỗi kết nối MySQL |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Có | Hai khóa ký token, mỗi khóa ≥ 32 ký tự và phải khác nhau |
| `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` | Có | Thời hạn token, ví dụ `15m` và `7d` |
| `PORT` | Không | Cổng HTTP, mặc định 3000 |
| `LOG_LEVEL` | Không | `debug` ở dev, `info` ở production |
| `LOGIN_RATE_LIMIT` | Không | Số lần đăng nhập tối đa mỗi phút mỗi IP, mặc định 5 |
| `CORS_ORIGINS` | Không | Danh sách origin được phép, cách nhau dấu phẩy |
| `SWAGGER_ENABLED`, `SWAGGER_USER`, `SWAGGER_PASSWORD` | Không | Bật Swagger; bật ở production thì bắt buộc có tài khoản basic-auth |

Danh sách đầy đủ và mô tả: [docs/05-ops/env-vars.md](docs/05-ops/env-vars.md).

## Cấu trúc thư mục

```
src/
  main.ts, app.module.ts, app.setup.ts   # khởi động và cấu hình dùng chung
  common/        # lỗi chuẩn, phân trang, sinh mã, thời gian, validator dùng chung
  config/        # cấu hình có kiểu (app, auth)
  prisma/        # PrismaService
  audit/         # nhật ký thao tác (GET /audit)
  health/        # health check
  auth/          # đăng nhập, guard, phân quyền
  roles/  users/
  loai-hang/  hang-hoa/  ty-le-quy-doi/
prisma/          # schema, migration, seed
test/            # e2e và các hàm hỗ trợ test
docs/            # kế hoạch và tài liệu chi tiết
```

Unit test đặt cạnh file nguồn (`*.spec.ts`); e2e nằm trong `test/*.e2e-spec.ts`.

## Quy ước chính

- **API:** prefix `/api/v1`; thành công trả thẳng dữ liệu, danh sách trả `{ items, meta }`; lỗi trả body chuẩn có `code` (xem [docs/06-api/conventions.md](docs/06-api/conventions.md)).
- **Tiền** truyền dưới dạng chuỗi (`"125000.00"`), **ngày** dạng `YYYY-MM-DD`, múi giờ nghiệp vụ là Asia/Ho_Chi_Minh.
- **Ngôn ngữ:** thuật ngữ nghiệp vụ bằng tiếng Việt không dấu (`HangHoa`, `hanSuDung`), tên kỹ thuật bằng tiếng Anh, thông báo cho người dùng bằng tiếng Việt, log và commit bằng tiếng Anh.
- **Phân quyền:** 4 vai trò cố định `ADMIN`, `QUAN_LY_KHO`, `NHAN_VIEN_KHO`, `KE_TOAN` (xem [docs/03-cross-cutting/permissions.md](docs/03-cross-cutting/permissions.md)).

## Tài liệu

| Nội dung | Vị trí |
|---|---|
| Mục lục và thứ tự đọc | [docs/README.md](docs/README.md) |
| Bối cảnh nghiệp vụ, kiến trúc, lộ trình | [docs/00-overview/](docs/00-overview/) |
| Mô hình dữ liệu và đề xuất thay đổi schema | [docs/01-data/](docs/01-data/) |
| Từng module (mục đích, API, quy tắc, test) | [docs/02-modules/](docs/02-modules/) |
| Danh mục toàn bộ endpoint | [docs/06-api/endpoints-catalog.md](docs/06-api/endpoints-catalog.md) |
| Câu hỏi cần chốt trước khi làm tiếp | [docs/open-questions.md](docs/open-questions.md) |
| Module Auth | [docs/auth/README.md](docs/auth/README.md) |

## Giấy phép

Mã nguồn nội bộ, chưa phát hành công khai (`UNLICENSED`).
