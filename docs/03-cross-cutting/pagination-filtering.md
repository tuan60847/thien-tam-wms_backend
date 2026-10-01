# Phân trang, lọc, sắp xếp

Áp dụng cho **mọi** endpoint danh sách (`GET /<resource>`). Cài đặt một lần ở `src/common/pagination/`.

## 1. Query chung — `PaginationQueryDto`

| Param | Kiểu | Mặc định | Quy tắc |
|---|---|---|---|
| `page` | số nguyên | `1` | ≥ 1 |
| `pageSize` | số nguyên | `20` | 1…100 (vượt → `400 VALIDATION_FAILED`, không âm thầm cắt) |
| `sort` | chuỗi | theo module (thường `createdAt:desc`) | `field:asc|desc`, nhiều field cách nhau dấu phẩy: `sort=hanSuDung:asc,tenLo:asc`; field phải thuộc **whitelist** của module, sai → `400` |
| `q` | chuỗi ≤ 100 | — | tìm kiếm văn bản tự do trên các cột whitelist của module (không phân biệt hoa thường, `contains`) |

Mỗi module `Query<X>Dto extends PaginationQueryDto` và thêm bộ lọc riêng. Bộ lọc và whitelist sort khai báo trong module doc (mục 6).

## 2. Ngữ pháp lọc

| Kiểu | Param | Ví dụ | Ý nghĩa |
|---|---|---|---|
| Bằng | `<field>` | `trangThai=da_nhap_kho` | khớp chính xác |
| Một trong | `<field>` lặp hoặc phân tách phẩy | `trangThai=cho_xu_ly,da_xuat_kho` | `IN` (tối đa 10 giá trị) |
| Khóa ngoại | `<relation>Id` | `khachHangId=<uuid>` | khớp id |
| Boolean | `<field>=true|false` | `isCanGiuLanh=true` | chỉ chấp nhận `true`/`false` |
| Khoảng ngày | `<field>From`, `<field>To` | `createdAtFrom=2026-09-01&createdAtTo=2026-09-30` | `>=` đầu ngày From, `<=` cuối ngày To theo giờ VN, **bao gồm cả hai đầu**; chỉ nhận `YYYY-MM-DD` |
| Khoảng số | `<field>Min`, `<field>Max` | `soLuongMin=10` | `>=`, `<=` |
| Văn bản | `q` | `q=paracetamol` | `contains` trên cột whitelist |

Quy tắc:
1. Param lạ → `400` (do `forbidNonWhitelisted`).
2. Giá trị rỗng (`?trangThai=`) = không lọc.
3. Lọc nhiều field kết hợp bằng `AND`.
4. Không có toán tử `OR` tổng quát ở phase 1.
5. Khoảng ngày sai thứ tự (`From > To`) → `400`.
6. Mọi ID là UUID: `@IsUUID()`; sai định dạng → `400`.

## 3. Response danh sách

```json
{
  "items": [ { "id": "…", "…": "…" } ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 134,
    "totalPages": 7
  }
}
```

- Không bọc `data`. `items` là mảng response DTO (rỗng nếu không có kết quả, không phải `404`).
- `total` đếm theo cùng điều kiện lọc (không theo trang).
- `page` vượt `totalPages` → trả `items: []` với `meta` đúng (không lỗi).
- Giới hạn cứng `pageSize ≤ 100`; export lớn qua endpoint báo cáo riêng, không nới `pageSize`.

Kiểu TypeScript dùng chung: `PagedResponse<T> = { items: T[]; meta: PageMeta }`.

## 4. Cài đặt (đề xuất)

Helper `paginate({ prisma-delegate, where, orderBy, page, pageSize, select/include })`:
- chạy `findMany({ skip, take })` và `count({ where })` song song trong một `Promise.all` (không cần transaction cho danh sách);
- trả `{ items, meta }`.

Helper `parseSort(sort, whitelist, defaultSort): Prisma.XOrderByWithRelationInput[]`:
- bỏ qua khoảng trắng; từ chối field ngoài whitelist bằng `AppException VALIDATION_FAILED`;
- luôn thêm `id` làm khóa phụ cuối để thứ tự ổn định giữa các trang.

Helper `dateRangeFilter(from, to)` dựng `{ gte, lte }` theo múi giờ VN → UTC.

## 5. Hiệu năng

- Phân trang offset (`skip/take`) đủ cho quy mô hiện tại (hàng chục nghìn dòng). Nếu danh sách chứng từ lớn dần, chuyển các list sâu sang cursor (`cursor` theo `createdAt,id`) — chưa làm ở phase 1.
- Mỗi trường có thể sort/lọc phải có index hỗ trợ (xem [schema-notes.md](../01-data/schema-notes.md) §5). Whitelist sort chỉ gồm cột có index hoặc bảng nhỏ.
- `q` trên văn bản dùng `contains` (`LIKE %q%`) — chấp nhận được với danh mục < 50k dòng; nếu chậm, thêm `FULLTEXT` (đã nêu P-05).

## 6. Kiểm thử

Unit (helper): `parseSort` hợp lệ/sai field/nhiều field/khóa phụ `id`; `dateRangeFilter` biên ngày và múi giờ; `paginate` tính `totalPages` (0 bản ghi, chia hết, dư).
e2e mỗi module: `pageSize=1` trả đúng 1 item + `meta.total`; `page` vượt giới hạn trả rỗng; `sort` field lạ → 400; một bộ lọc đặc trưng; `pageSize=101` → 400.
