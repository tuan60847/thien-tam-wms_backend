-- AlterTable
ALTER TABLE `so_lo` ADD COLUMN `created_by_id` VARCHAR(191) NULL,
    ADD COLUMN `updated_by_id` VARCHAR(191) NULL,
    MODIFY `ten_lo` VARCHAR(50) NOT NULL;

-- CreateTable
CREATE TABLE `bien_dong_ton_kho` (
    `id` VARCHAR(191) NOT NULL,
    `loai` ENUM('nhap_kho', 'xuat_kho', 'huy_nhap', 'huy_xuat', 'chuyen_di', 'chuyen_den', 'dieu_chinh') NOT NULL,
    `so_luong_thay_doi` INTEGER NOT NULL,
    `so_luong_sau` INTEGER NOT NULL,
    `loai_tham_chieu` VARCHAR(50) NULL,
    `tham_chieu_id` VARCHAR(36) NULL,
    `ly_do` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `so_lo_id` VARCHAR(191) NOT NULL,
    `vi_tri_id` VARCHAR(191) NOT NULL,
    `created_by_id` VARCHAR(191) NULL,

    INDEX `bien_dong_ton_kho_so_lo_id_created_at_idx`(`so_lo_id`, `created_at`),
    INDEX `bien_dong_ton_kho_vi_tri_id_created_at_idx`(`vi_tri_id`, `created_at`),
    INDEX `bien_dong_ton_kho_loai_tham_chieu_tham_chieu_id_idx`(`loai_tham_chieu`, `tham_chieu_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `so_lo` ADD CONSTRAINT `so_lo_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `so_lo` ADD CONSTRAINT `so_lo_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bien_dong_ton_kho` ADD CONSTRAINT `bien_dong_ton_kho_so_lo_id_fkey` FOREIGN KEY (`so_lo_id`) REFERENCES `so_lo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bien_dong_ton_kho` ADD CONSTRAINT `bien_dong_ton_kho_vi_tri_id_fkey` FOREIGN KEY (`vi_tri_id`) REFERENCES `vi_tri`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bien_dong_ton_kho` ADD CONSTRAINT `bien_dong_ton_kho_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Lưới an toàn cuối cùng: tồn kho không bao giờ âm, dù service có lỗi.
-- (Prisma không biểu diễn được CHECK nên thêm bằng SQL thô.)
ALTER TABLE `ton_kho` ADD CONSTRAINT `ton_kho_so_luong_khong_am` CHECK (`so_luong` >= 0);
