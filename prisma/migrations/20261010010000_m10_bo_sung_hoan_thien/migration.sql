-- AlterTable
ALTER TABLE `chi_tiet_bao_gia` ADD COLUMN `thu_tu` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `phieu_xuat_hang` ADD COLUMN `phuong_thuc_thu` ENUM('tien_mat', 'chuyen_khoan') NULL;

-- CreateIndex
CREATE UNIQUE INDEX `tai_khoan_ngan_hang_khach_hang_id_so_tai_khoan_ten_ngan_hang_key` ON `tai_khoan_ngan_hang`(`khach_hang_id`, `so_tai_khoan`, `ten_ngan_hang`);

-- CreateIndex
CREATE UNIQUE INDEX `tai_khoan_ngan_hang_nha_cung_cap_id_so_tai_khoan_ten_ngan_ha_key` ON `tai_khoan_ngan_hang`(`nha_cung_cap_id`, `so_tai_khoan`, `ten_ngan_hang`);

