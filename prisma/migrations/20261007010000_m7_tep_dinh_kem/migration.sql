-- CreateTable
CREATE TABLE `tep_dinh_kem` (
    `id` VARCHAR(191) NOT NULL,
    `loai_doi_tuong` ENUM('khach_hang', 'nha_cung_cap', 'hang_hoa', 'phieu_nhap_hang', 'so_lo') NOT NULL,
    `doi_tuong_id` VARCHAR(36) NOT NULL,
    `ten_file` VARCHAR(150) NOT NULL,
    `mime` VARCHAR(100) NOT NULL,
    `kich_thuoc` INTEGER NOT NULL,
    `duong_dan` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by_id` VARCHAR(191) NULL,

    UNIQUE INDEX `tep_dinh_kem_duong_dan_key`(`duong_dan`),
    INDEX `tep_dinh_kem_loai_doi_tuong_doi_tuong_id_idx`(`loai_doi_tuong`, `doi_tuong_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tep_dinh_kem` ADD CONSTRAINT `tep_dinh_kem_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

