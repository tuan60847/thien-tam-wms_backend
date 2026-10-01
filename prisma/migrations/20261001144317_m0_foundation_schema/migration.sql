-- AlterTable
ALTER TABLE `chi_tiet_phieu_nhap_hang` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `chi_tiet_phieu_xuat_hang` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `hang_hoa` ADD COLUMN `trang_thai` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `loai_kiem_soat` ENUM('thuong', 'ke_don', 'kiem_soat_dac_biet') NULL;

-- AlterTable
ALTER TABLE `khach_hang` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    MODIFY `trang_thai` ENUM('hoat_dong', 'ngung_hoat_dong') NOT NULL DEFAULT 'hoat_dong',
    MODIFY `ngay_cap_gpkd` DATE NULL,
    MODIFY `ngay_het_han_gpkd` DATE NULL;

-- AlterTable
ALTER TABLE `kho` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `trang_thai` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `loai_hang` ADD COLUMN `trang_thai` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `nha_cung_cap` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `trang_thai` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    MODIFY `trang_thai_xac_minh` ENUM('chua_xac_minh', 'da_xac_minh', 'tu_choi') NOT NULL DEFAULT 'chua_xac_minh',
    MODIFY `ngay_cap_gpkd` DATE NULL,
    MODIFY `ngay_cap_gcn_duoc` DATE NULL;

-- AlterTable
-- Đổi tên cột (không DROP + ADD để giữ dữ liệu); CHANGE COLUMN chạy được trên cả MySQL 8 và MariaDB 10.4.
ALTER TABLE `phieu_nhap_hang` CHANGE COLUMN `create_at` `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    MODIFY `trang_thai` ENUM('cho_xac_nhan', 'da_nhap_kho', 'da_huy') NOT NULL DEFAULT 'cho_xac_nhan';

-- AlterTable
ALTER TABLE `phieu_thanh_toan` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    MODIFY `ngay_thanh_toan` DATE NOT NULL;

-- AlterTable
ALTER TABLE `phieu_thu_cong_no` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    MODIFY `ngay_thanh_toan` DATE NOT NULL;

-- AlterTable
ALTER TABLE `phieu_xuat_hang` ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    MODIFY `trang_thai` ENUM('cho_xu_ly', 'da_xuat_kho', 'da_giao', 'da_huy') NOT NULL DEFAULT 'cho_xu_ly';

-- AlterTable
ALTER TABLE `phuong_tien_van_chuyen` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `trang_thai` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `so_lo` MODIFY `ngay_sx` DATE NULL,
    MODIFY `han_su_dung` DATE NOT NULL,
    MODIFY `trang_thai` ENUM('con_han', 'can_date', 'het_han') NOT NULL DEFAULT 'con_han';

-- AlterTable
ALTER TABLE `ton_kho` ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `ty_le_quy_doi` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `vi_tri` ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `trang_thai` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `nhat_ky_he_thong` (
    `id` VARCHAR(191) NOT NULL,
    `hanh_dong` VARCHAR(100) NOT NULL,
    `doi_tuong` VARCHAR(50) NOT NULL,
    `doi_tuong_id` VARCHAR(36) NULL,
    `truoc` JSON NULL,
    `sau` JSON NULL,
    `ly_do` VARCHAR(255) NULL,
    `ip` VARCHAR(45) NULL,
    `request_id` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_id` VARCHAR(191) NULL,

    INDEX `nhat_ky_he_thong_doi_tuong_doi_tuong_id_idx`(`doi_tuong`, `doi_tuong_id`),
    INDEX `nhat_ky_he_thong_hanh_dong_created_at_idx`(`hanh_dong`, `created_at`),
    INDEX `nhat_ky_he_thong_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bo_dem_ma` (
    `tien_to` VARCHAR(10) NOT NULL,
    `ngay` VARCHAR(6) NOT NULL DEFAULT '',
    `gia_tri` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`tien_to`, `ngay`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `khach_hang_ma_so_thue_key` ON `khach_hang`(`ma_so_thue`);

-- CreateIndex
CREATE UNIQUE INDEX `kho_ten_kho_key` ON `kho`(`ten_kho`);

-- CreateIndex
CREATE UNIQUE INDEX `loai_hang_ten_loai_hang_key` ON `loai_hang`(`ten_loai_hang`);

-- CreateIndex
CREATE INDEX `phieu_nhap_hang_trang_thai_created_at_idx` ON `phieu_nhap_hang`(`trang_thai`, `created_at`);

-- CreateIndex
CREATE INDEX `phieu_thanh_toan_ngay_thanh_toan_idx` ON `phieu_thanh_toan`(`ngay_thanh_toan`);

-- CreateIndex
CREATE INDEX `phieu_thu_cong_no_ngay_thanh_toan_idx` ON `phieu_thu_cong_no`(`ngay_thanh_toan`);

-- CreateIndex
CREATE INDEX `phieu_xuat_hang_trang_thai_created_at_idx` ON `phieu_xuat_hang`(`trang_thai`, `created_at`);

-- CreateIndex
CREATE INDEX `so_lo_han_su_dung_idx` ON `so_lo`(`han_su_dung`);

-- CreateIndex
CREATE INDEX `so_lo_hang_hoa_id_han_su_dung_idx` ON `so_lo`(`hang_hoa_id`, `han_su_dung`);

-- CreateIndex
CREATE UNIQUE INDEX `so_lo_hang_hoa_id_ten_lo_key` ON `so_lo`(`hang_hoa_id`, `ten_lo`);

-- CreateIndex
CREATE UNIQUE INDEX `ty_le_quy_doi_hang_hoa_id_don_vi_tinh_key` ON `ty_le_quy_doi`(`hang_hoa_id`, `don_vi_tinh`);

-- CreateIndex
CREATE UNIQUE INDEX `vi_tri_kho_id_ten_vi_tri_key` ON `vi_tri`(`kho_id`, `ten_vi_tri`);

-- AddForeignKey
ALTER TABLE `nhat_ky_he_thong` ADD CONSTRAINT `nhat_ky_he_thong_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

