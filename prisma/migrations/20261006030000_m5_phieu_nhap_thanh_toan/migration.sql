-- AlterTable
ALTER TABLE `chi_tiet_phieu_nhap_hang` ADD COLUMN `don_vi_tinh` VARCHAR(30) NOT NULL,
    ADD COLUMN `he_so_quy_doi` INTEGER NOT NULL,
    ADD COLUMN `so_luong_co_ban` INTEGER NOT NULL,
    ADD COLUMN `vi_tri_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `phieu_nhap_hang` ADD COLUMN `ghi_chu` VARCHAR(500) NULL,
    ADD COLUMN `huy_at` DATETIME(3) NULL,
    ADD COLUMN `huy_by_id` VARCHAR(191) NULL,
    ADD COLUMN `ly_do_huy` VARCHAR(255) NULL,
    ADD COLUMN `updated_by_id` VARCHAR(191) NULL,
    ADD COLUMN `xac_nhan_at` DATETIME(3) NULL,
    ADD COLUMN `xac_nhan_by_id` VARCHAR(191) NULL,
    MODIFY `ngay_nhan_hang` DATE NULL;

-- AlterTable
ALTER TABLE `phieu_thanh_toan` ADD COLUMN `created_by_id` VARCHAR(191) NULL,
    ADD COLUMN `ghi_chu` VARCHAR(255) NULL,
    ADD COLUMN `huy_at` DATETIME(3) NULL,
    ADD COLUMN `huy_by_id` VARCHAR(191) NULL,
    ADD COLUMN `ly_do_huy` VARCHAR(255) NULL,
    ADD COLUMN `phuong_thuc` ENUM('tien_mat', 'chuyen_khoan') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `chi_tiet_phieu_nhap_hang_phieu_nhap_hang_id_so_lo_id_vi_tri__key` ON `chi_tiet_phieu_nhap_hang`(`phieu_nhap_hang_id`, `so_lo_id`, `vi_tri_id`);

-- AddForeignKey
ALTER TABLE `phieu_nhap_hang` ADD CONSTRAINT `phieu_nhap_hang_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_nhap_hang` ADD CONSTRAINT `phieu_nhap_hang_xac_nhan_by_id_fkey` FOREIGN KEY (`xac_nhan_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_nhap_hang` ADD CONSTRAINT `phieu_nhap_hang_huy_by_id_fkey` FOREIGN KEY (`huy_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_phieu_nhap_hang` ADD CONSTRAINT `chi_tiet_phieu_nhap_hang_vi_tri_id_fkey` FOREIGN KEY (`vi_tri_id`) REFERENCES `vi_tri`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_thanh_toan` ADD CONSTRAINT `phieu_thanh_toan_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_thanh_toan` ADD CONSTRAINT `phieu_thanh_toan_huy_by_id_fkey` FOREIGN KEY (`huy_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written CHECK constraints (not expressible in the Prisma schema)
ALTER TABLE `chi_tiet_phieu_nhap_hang` ADD CONSTRAINT `chi_tiet_phieu_nhap_so_luong_duong` CHECK (`so_luong` > 0 AND `so_luong_co_ban` > 0 AND `he_so_quy_doi` > 0 AND `don_gia` >= 0);
ALTER TABLE `phieu_thanh_toan` ADD CONSTRAINT `phieu_thanh_toan_so_tien_duong` CHECK (`so_tien` > 0);
