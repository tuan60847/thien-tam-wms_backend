-- AlterTable
ALTER TABLE `chi_tiet_phieu_xuat_hang` ADD COLUMN `don_vi_tinh` VARCHAR(30) NOT NULL,
    ADD COLUMN `he_so_quy_doi` INTEGER NOT NULL,
    ADD COLUMN `so_luong_co_ban` INTEGER NOT NULL,
    ADD COLUMN `vi_tri_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `phieu_thu_cong_no` ADD COLUMN `created_by_id` VARCHAR(191) NULL,
    ADD COLUMN `ghi_chu` VARCHAR(255) NULL,
    ADD COLUMN `huy_at` DATETIME(3) NULL,
    ADD COLUMN `huy_by_id` VARCHAR(191) NULL,
    ADD COLUMN `ly_do_huy` VARCHAR(255) NULL,
    ADD COLUMN `phuong_thuc` ENUM('tien_mat', 'chuyen_khoan') NOT NULL;

-- AlterTable
ALTER TABLE `phieu_xuat_hang` ADD COLUMN `ghi_chu` VARCHAR(500) NULL,
    ADD COLUMN `huy_at` DATETIME(3) NULL,
    ADD COLUMN `huy_by_id` VARCHAR(191) NULL,
    ADD COLUMN `ly_do_huy` VARCHAR(255) NULL,
    ADD COLUMN `ngay_giao_thuc_te` DATE NULL,
    ADD COLUMN `ngay_xuat_kho` DATE NULL,
    ADD COLUMN `phuong_tien_van_chuyen_id` VARCHAR(191) NULL,
    ADD COLUMN `updated_by_id` VARCHAR(191) NULL,
    ADD COLUMN `xuat_kho_by_id` VARCHAR(191) NULL,
    MODIFY `ngay_giao_hang` DATE NULL;

-- CreateIndex
CREATE UNIQUE INDEX `chi_tiet_phieu_xuat_hang_phieu_xuat_hang_id_so_lo_id_vi_tri__key` ON `chi_tiet_phieu_xuat_hang`(`phieu_xuat_hang_id`, `so_lo_id`, `vi_tri_id`);

-- AddForeignKey
ALTER TABLE `phieu_xuat_hang` ADD CONSTRAINT `phieu_xuat_hang_phuong_tien_van_chuyen_id_fkey` FOREIGN KEY (`phuong_tien_van_chuyen_id`) REFERENCES `phuong_tien_van_chuyen`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_xuat_hang` ADD CONSTRAINT `phieu_xuat_hang_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_xuat_hang` ADD CONSTRAINT `phieu_xuat_hang_xuat_kho_by_id_fkey` FOREIGN KEY (`xuat_kho_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_xuat_hang` ADD CONSTRAINT `phieu_xuat_hang_huy_by_id_fkey` FOREIGN KEY (`huy_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_phieu_xuat_hang` ADD CONSTRAINT `chi_tiet_phieu_xuat_hang_vi_tri_id_fkey` FOREIGN KEY (`vi_tri_id`) REFERENCES `vi_tri`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_thu_cong_no` ADD CONSTRAINT `phieu_thu_cong_no_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_thu_cong_no` ADD CONSTRAINT `phieu_thu_cong_no_huy_by_id_fkey` FOREIGN KEY (`huy_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written CHECK constraints (not expressible in the Prisma schema)
ALTER TABLE `chi_tiet_phieu_xuat_hang` ADD CONSTRAINT `chi_tiet_phieu_xuat_so_luong_duong` CHECK (`so_luong` > 0 AND `so_luong_co_ban` > 0 AND `he_so_quy_doi` > 0 AND `don_gia` >= 0);
ALTER TABLE `phieu_thu_cong_no` ADD CONSTRAINT `phieu_thu_cong_no_so_tien_duong` CHECK (`so_tien` > 0);
