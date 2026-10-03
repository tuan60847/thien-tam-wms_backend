
-- AlterTable
ALTER TABLE `hang_hoa` ADD COLUMN `created_by_id` VARCHAR(191) NULL,
    ADD COLUMN `don_vi_tinh_gia` VARCHAR(30) NOT NULL,
    ADD COLUMN `ma_sp` VARCHAR(20) NOT NULL,
    ADD COLUMN `updated_by_id` VARCHAR(191) NULL,
    MODIFY `ten_sp` VARCHAR(200) NOT NULL,
    MODIFY `quy_cach` VARCHAR(200) NULL,
    MODIFY `ghi_chu` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `loai_hang` MODIFY `ghi_chu` VARCHAR(500) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `hang_hoa_ma_sp_key` ON `hang_hoa`(`ma_sp`);

-- AddForeignKey
ALTER TABLE `hang_hoa` ADD CONSTRAINT `hang_hoa_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hang_hoa` ADD CONSTRAINT `hang_hoa_updated_by_id_fkey` FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

