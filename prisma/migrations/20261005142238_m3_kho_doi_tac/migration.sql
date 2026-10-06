-- AlterTable
ALTER TABLE `kho` MODIFY `ten_kho` VARCHAR(100) NOT NULL,
    MODIFY `dia_chi` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `vi_tri` MODIFY `ten_vi_tri` VARCHAR(50) NOT NULL,
    MODIFY `ghi_chu` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `khach_hang` ADD COLUMN `created_by_id` VARCHAR(191) NULL,
    ADD COLUMN `updated_by_id` VARCHAR(191) NULL,
    MODIFY `ten_kh` VARCHAR(200) NOT NULL,
    MODIFY `dia_chi` VARCHAR(255) NULL,
    MODIFY `ma_so_thue` VARCHAR(14) NULL,
    MODIFY `email` VARCHAR(150) NULL,
    MODIFY `SDT` VARCHAR(15) NULL,
    MODIFY `nguoi_dai_dien` VARCHAR(100) NULL,
    MODIFY `sdt_ndd` VARCHAR(15) NULL,
    MODIFY `so_giay_phep_kinh_doanh` VARCHAR(50) NULL;

-- AlterTable
ALTER TABLE `nha_cung_cap` ADD COLUMN `created_by_id` VARCHAR(191) NULL,
    ADD COLUMN `ma_ncc` VARCHAR(20) NOT NULL,
    ADD COLUMN `ngay_het_han_gcn_duoc` DATE NULL,
    ADD COLUMN `ngay_het_han_gpkd` DATE NULL,
    ADD COLUMN `updated_by_id` VARCHAR(191) NULL,
    ADD COLUMN `xac_minh_at` DATETIME(3) NULL,
    ADD COLUMN `xac_minh_by_id` VARCHAR(191) NULL,
    MODIFY `ten_ncc` VARCHAR(200) NOT NULL,
    MODIFY `SDT` VARCHAR(15) NULL,
    MODIFY `dia_chi` VARCHAR(255) NULL,
    MODIFY `ten_nguoi_phu_trach` VARCHAR(100) NULL,
    MODIFY `sdt_nguoi_pt` VARCHAR(15) NULL,
    MODIFY `ghi_chu` VARCHAR(500) NULL,
    MODIFY `so_giay_phep_kinh_doanh` VARCHAR(50) NULL,
    MODIFY `noi_cap_gpkd` VARCHAR(255) NULL,
    MODIFY `so_gcn_du_dieu_kien_kinh_doanh_duoc` VARCHAR(50) NULL,
    MODIFY `noi_cap_gcn_duoc` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `phuong_tien_van_chuyen` ADD COLUMN `is_xe_lanh` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `bien_so` VARCHAR(15) NOT NULL,
    MODIFY `loai_phuong_tien` VARCHAR(50) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `nha_cung_cap_ma_ncc_key` ON `nha_cung_cap`(`ma_ncc`);

-- AddForeignKey
ALTER TABLE `khach_hang` ADD CONSTRAINT `khach_hang_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `khach_hang` ADD CONSTRAINT `khach_hang_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nha_cung_cap` ADD CONSTRAINT `nha_cung_cap_xac_minh_by_id_fkey` FOREIGN KEY (`xac_minh_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nha_cung_cap` ADD CONSTRAINT `nha_cung_cap_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nha_cung_cap` ADD CONSTRAINT `nha_cung_cap_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

