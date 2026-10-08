-- AlterTable
ALTER TABLE `chi_tiet_phieu_xuat_hang` ADD COLUMN `don_gia_von` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `la_hang_khuyen_mai` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `thue_suat_gtgt` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `tien_chiet_khau` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `tien_gia_von` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `tien_thue_gtgt` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `ty_le_chiet_khau` DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `hang_hoa` ADD COLUMN `ma_quy_cach` VARCHAR(50) NULL,
    ADD COLUMN `thue_suat_gtgt` DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `khach_hang` ADD COLUMN `dai_dien_theo_phap_luat` VARCHAR(200) NULL,
    ADD COLUMN `dien_giai` VARCHAR(500) NULL,
    ADD COLUMN `dieu_khoan_thanh_toan_id` VARCHAR(191) NULL,
    ADD COLUMN `dt_co_dinh` VARCHAR(20) NULL,
    ADD COLUMN `fax` VARCHAR(20) NULL,
    ADD COLUMN `hoa_don_dia_chi` VARCHAR(500) NULL,
    ADD COLUMN `hoa_don_dien_thoai` VARCHAR(20) NULL,
    ADD COLUMN `hoa_don_email` VARCHAR(150) NULL,
    ADD COLUMN `hoa_don_ten_nguoi_nhan` VARCHAR(200) NULL,
    ADD COLUMN `lien_he_chuc_danh` VARCHAR(100) NULL,
    ADD COLUMN `lien_he_dia_chi` VARCHAR(500) NULL,
    ADD COLUMN `lien_he_dien_thoai` VARCHAR(20) NULL,
    ADD COLUMN `lien_he_email` VARCHAR(150) NULL,
    ADD COLUMN `lien_he_ho_ten` VARCHAR(200) NULL,
    ADD COLUMN `loai_chu_the` ENUM('to_chuc', 'ca_nhan') NOT NULL DEFAULT 'to_chuc',
    ADD COLUMN `ngay_cap` DATE NULL,
    ADD COLUMN `nhan_vien_ban_hang_id` VARCHAR(191) NULL,
    ADD COLUMN `nhom_doi_tac_id` VARCHAR(191) NULL,
    ADD COLUMN `noi_cap` VARCHAR(255) NULL,
    ADD COLUMN `quan_huyen` VARCHAR(100) NULL,
    ADD COLUMN `quoc_gia` VARCHAR(100) NOT NULL DEFAULT 'Việt Nam',
    ADD COLUMN `so_cccd` VARCHAR(20) NULL,
    ADD COLUMN `so_ho_chieu` VARCHAR(30) NULL,
    ADD COLUMN `so_ngay_duoc_no` INTEGER NULL,
    ADD COLUMN `so_no_toi_da` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `tinh_tp` VARCHAR(100) NULL,
    ADD COLUMN `website` VARCHAR(200) NULL,
    ADD COLUMN `xa_phuong` VARCHAR(100) NULL,
    ADD COLUMN `xung_ho` VARCHAR(20) NULL;

-- AlterTable
ALTER TABLE `nha_cung_cap` ADD COLUMN `dieu_khoan_thanh_toan_id` VARCHAR(191) NULL,
    ADD COLUMN `dt_co_dinh` VARCHAR(20) NULL,
    ADD COLUMN `email` VARCHAR(150) NULL,
    ADD COLUMN `fax` VARCHAR(20) NULL,
    ADD COLUMN `loai_chu_the` ENUM('to_chuc', 'ca_nhan') NOT NULL DEFAULT 'to_chuc',
    ADD COLUMN `ma_so_thue` VARCHAR(20) NULL,
    ADD COLUMN `nhan_vien_mua_hang_id` VARCHAR(191) NULL,
    ADD COLUMN `nhom_doi_tac_id` VARCHAR(191) NULL,
    ADD COLUMN `quan_huyen` VARCHAR(100) NULL,
    ADD COLUMN `quoc_gia` VARCHAR(100) NOT NULL DEFAULT 'Việt Nam',
    ADD COLUMN `so_cccd` VARCHAR(20) NULL,
    ADD COLUMN `so_ngay_duoc_no` INTEGER NULL,
    ADD COLUMN `so_no_toi_da` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `tinh_tp` VARCHAR(100) NULL,
    ADD COLUMN `website` VARCHAR(200) NULL,
    ADD COLUMN `xa_phuong` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `phieu_thu_cong_no` ADD COLUMN `ngay_ghi_so_quy` DATE NULL,
    ADD COLUMN `nguoi_nop` VARCHAR(200) NULL,
    ADD COLUMN `nhan_vien_ban_hang_id` VARCHAR(191) NULL,
    ADD COLUMN `tien_chiet_khau` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `ty_le_chiet_khau` DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `phieu_xuat_hang` ADD COLUMN `bao_gia_id` VARCHAR(191) NULL,
    ADD COLUMN `da_lap_hoa_don` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `dieu_khoan_khac` VARCHAR(1000) NULL,
    ADD COLUMN `dieu_khoan_thanh_toan_id` VARCHAR(191) NULL,
    ADD COLUMN `han_thanh_toan` DATE NULL,
    ADD COLUMN `hinh_thuc_thanh_toan` ENUM('chua_thu_tien', 'thu_tien_ngay') NOT NULL DEFAULT 'chua_thu_tien',
    ADD COLUMN `khach_dia_chi_snapshot` VARCHAR(500) NULL,
    ADD COLUMN `khach_ma_so_thue_snapshot` VARCHAR(20) NULL,
    ADD COLUMN `khach_ten_snapshot` VARCHAR(255) NULL,
    ADD COLUMN `lap_kem_hoa_don` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `nguoi_lien_he` VARCHAR(200) NULL,
    ADD COLUMN `nhan_vien_ban_hang_id` VARCHAR(191) NULL,
    ADD COLUMN `so_ngay_duoc_no` INTEGER NULL,
    ADD COLUMN `ten_mat_hang_chung` VARCHAR(255) NULL,
    ADD COLUMN `tham_chieu` VARCHAR(255) NULL,
    ADD COLUMN `tinh_trang_no` ENUM('no_binh_thuong', 'no_kho_doi', 'no_khong_the_doi') NOT NULL DEFAULT 'no_binh_thuong';

-- CreateTable
CREATE TABLE `nhom_doi_tac` (
    `id` VARCHAR(191) NOT NULL,
    `ma` VARCHAR(20) NOT NULL,
    `ten` VARCHAR(200) NOT NULL,

    UNIQUE INDEX `nhom_doi_tac_ma_key`(`ma`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dieu_khoan_thanh_toan` (
    `id` VARCHAR(191) NOT NULL,
    `ma` VARCHAR(20) NOT NULL,
    `ten` VARCHAR(200) NOT NULL,
    `so_ngay_duoc_no` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `dieu_khoan_thanh_toan_ma_key`(`ma`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nhan_vien_kinh_doanh` (
    `id` VARCHAR(191) NOT NULL,
    `ma_nv` VARCHAR(20) NOT NULL,
    `ho_ten` VARCHAR(200) NOT NULL,
    `dien_thoai` VARCHAR(20) NULL,
    `trang_thai` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `user_id` VARCHAR(191) NULL,

    UNIQUE INDEX `nhan_vien_kinh_doanh_ma_nv_key`(`ma_nv`),
    UNIQUE INDEX `nhan_vien_kinh_doanh_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tai_khoan_ngan_hang` (
    `id` VARCHAR(191) NOT NULL,
    `so_tai_khoan` VARCHAR(30) NOT NULL,
    `ten_ngan_hang` VARCHAR(200) NOT NULL,
    `chi_nhanh` VARCHAR(200) NULL,
    `tinh_tp_ngan_hang` VARCHAR(100) NULL,
    `khach_hang_id` VARCHAR(191) NULL,
    `nha_cung_cap_id` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dia_diem_giao_hang` (
    `id` VARCHAR(191) NOT NULL,
    `dia_diem` VARCHAR(500) NOT NULL,
    `la_mac_dinh` BOOLEAN NOT NULL DEFAULT false,
    `khach_hang_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bao_gia` (
    `id` VARCHAR(191) NOT NULL,
    `ma_bao_gia` VARCHAR(30) NOT NULL,
    `ngay_bao_gia` DATE NOT NULL,
    `han_hieu_luc` DATE NULL,
    `ghiChu` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `khach_hang_id` VARCHAR(191) NOT NULL,
    `nhan_vien_ban_hang_id` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NULL,

    UNIQUE INDEX `bao_gia_ma_bao_gia_key`(`ma_bao_gia`),
    INDEX `bao_gia_khach_hang_id_idx`(`khach_hang_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chi_tiet_bao_gia` (
    `id` VARCHAR(191) NOT NULL,
    `don_vi_tinh` VARCHAR(30) NOT NULL,
    `so_luong` INTEGER NOT NULL,
    `don_gia` DECIMAL(15, 2) NOT NULL,
    `ty_le_chiet_khau` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `thue_suat_gtgt` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `bao_gia_id` VARCHAR(191) NOT NULL,
    `hang_hoa_id` VARCHAR(191) NOT NULL,

    INDEX `chi_tiet_bao_gia_bao_gia_id_idx`(`bao_gia_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tra_lai_hang_ban` (
    `id` VARCHAR(191) NOT NULL,
    `ma_tra_lai` VARCHAR(30) NOT NULL,
    `ngay_tra_lai` DATE NOT NULL,
    `trang_thai` ENUM('cho_xac_nhan', 'da_nhap_kho', 'da_huy') NOT NULL DEFAULT 'cho_xac_nhan',
    `ly_do` VARCHAR(255) NULL,
    `ghiChu` VARCHAR(500) NULL,
    `xac_nhan_at` DATETIME(3) NULL,
    `huy_at` DATETIME(3) NULL,
    `ly_do_huy` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `khach_hang_id` VARCHAR(191) NOT NULL,
    `phieu_xuat_hang_id` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NULL,

    UNIQUE INDEX `tra_lai_hang_ban_ma_tra_lai_key`(`ma_tra_lai`),
    INDEX `tra_lai_hang_ban_khach_hang_id_idx`(`khach_hang_id`),
    INDEX `tra_lai_hang_ban_trang_thai_created_at_idx`(`trang_thai`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chi_tiet_tra_lai` (
    `id` VARCHAR(191) NOT NULL,
    `ma_chi_tiet` VARCHAR(40) NOT NULL,
    `so_luong` INTEGER NOT NULL,
    `don_vi_tinh` VARCHAR(30) NOT NULL,
    `he_so_quy_doi` INTEGER NOT NULL,
    `so_luong_co_ban` INTEGER NOT NULL,
    `don_gia` DECIMAL(15, 2) NOT NULL,
    `ty_le_chiet_khau` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `tien_chiet_khau` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `tra_lai_id` VARCHAR(191) NOT NULL,
    `so_lo_id` VARCHAR(191) NOT NULL,
    `vi_tri_id` VARCHAR(191) NOT NULL,
    `chi_tiet_phieu_xuat_hang_id` VARCHAR(191) NULL,

    UNIQUE INDEX `chi_tiet_tra_lai_ma_chi_tiet_key`(`ma_chi_tiet`),
    INDEX `chi_tiet_tra_lai_tra_lai_id_idx`(`tra_lai_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `doi_tru_chung_tu` (
    `id` VARCHAR(191) NOT NULL,
    `ngay_doi_tru` DATE NOT NULL,
    `so_tien_doi_tru` DECIMAL(15, 2) NOT NULL,
    `da_bo_doi_tru` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `phieu_thu_cong_no_id` VARCHAR(191) NOT NULL,
    `phieu_xuat_hang_id` VARCHAR(191) NOT NULL,
    `created_by_id` VARCHAR(191) NULL,

    INDEX `doi_tru_chung_tu_phieu_thu_cong_no_id_idx`(`phieu_thu_cong_no_id`),
    INDEX `doi_tru_chung_tu_phieu_xuat_hang_id_idx`(`phieu_xuat_hang_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `khach_hang` ADD CONSTRAINT `khach_hang_nhom_doi_tac_id_fkey` FOREIGN KEY (`nhom_doi_tac_id`) REFERENCES `nhom_doi_tac`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `khach_hang` ADD CONSTRAINT `khach_hang_dieu_khoan_thanh_toan_id_fkey` FOREIGN KEY (`dieu_khoan_thanh_toan_id`) REFERENCES `dieu_khoan_thanh_toan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `khach_hang` ADD CONSTRAINT `khach_hang_nhan_vien_ban_hang_id_fkey` FOREIGN KEY (`nhan_vien_ban_hang_id`) REFERENCES `nhan_vien_kinh_doanh`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nha_cung_cap` ADD CONSTRAINT `nha_cung_cap_nhom_doi_tac_id_fkey` FOREIGN KEY (`nhom_doi_tac_id`) REFERENCES `nhom_doi_tac`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nha_cung_cap` ADD CONSTRAINT `nha_cung_cap_dieu_khoan_thanh_toan_id_fkey` FOREIGN KEY (`dieu_khoan_thanh_toan_id`) REFERENCES `dieu_khoan_thanh_toan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nha_cung_cap` ADD CONSTRAINT `nha_cung_cap_nhan_vien_mua_hang_id_fkey` FOREIGN KEY (`nhan_vien_mua_hang_id`) REFERENCES `nhan_vien_kinh_doanh`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_xuat_hang` ADD CONSTRAINT `phieu_xuat_hang_nhan_vien_ban_hang_id_fkey` FOREIGN KEY (`nhan_vien_ban_hang_id`) REFERENCES `nhan_vien_kinh_doanh`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_xuat_hang` ADD CONSTRAINT `phieu_xuat_hang_dieu_khoan_thanh_toan_id_fkey` FOREIGN KEY (`dieu_khoan_thanh_toan_id`) REFERENCES `dieu_khoan_thanh_toan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_xuat_hang` ADD CONSTRAINT `phieu_xuat_hang_bao_gia_id_fkey` FOREIGN KEY (`bao_gia_id`) REFERENCES `bao_gia`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_thu_cong_no` ADD CONSTRAINT `phieu_thu_cong_no_nhan_vien_ban_hang_id_fkey` FOREIGN KEY (`nhan_vien_ban_hang_id`) REFERENCES `nhan_vien_kinh_doanh`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nhan_vien_kinh_doanh` ADD CONSTRAINT `nhan_vien_kinh_doanh_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tai_khoan_ngan_hang` ADD CONSTRAINT `tai_khoan_ngan_hang_khach_hang_id_fkey` FOREIGN KEY (`khach_hang_id`) REFERENCES `khach_hang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tai_khoan_ngan_hang` ADD CONSTRAINT `tai_khoan_ngan_hang_nha_cung_cap_id_fkey` FOREIGN KEY (`nha_cung_cap_id`) REFERENCES `nha_cung_cap`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dia_diem_giao_hang` ADD CONSTRAINT `dia_diem_giao_hang_khach_hang_id_fkey` FOREIGN KEY (`khach_hang_id`) REFERENCES `khach_hang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bao_gia` ADD CONSTRAINT `bao_gia_khach_hang_id_fkey` FOREIGN KEY (`khach_hang_id`) REFERENCES `khach_hang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bao_gia` ADD CONSTRAINT `bao_gia_nhan_vien_ban_hang_id_fkey` FOREIGN KEY (`nhan_vien_ban_hang_id`) REFERENCES `nhan_vien_kinh_doanh`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bao_gia` ADD CONSTRAINT `bao_gia_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_bao_gia` ADD CONSTRAINT `chi_tiet_bao_gia_bao_gia_id_fkey` FOREIGN KEY (`bao_gia_id`) REFERENCES `bao_gia`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_bao_gia` ADD CONSTRAINT `chi_tiet_bao_gia_hang_hoa_id_fkey` FOREIGN KEY (`hang_hoa_id`) REFERENCES `hang_hoa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tra_lai_hang_ban` ADD CONSTRAINT `tra_lai_hang_ban_khach_hang_id_fkey` FOREIGN KEY (`khach_hang_id`) REFERENCES `khach_hang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tra_lai_hang_ban` ADD CONSTRAINT `tra_lai_hang_ban_phieu_xuat_hang_id_fkey` FOREIGN KEY (`phieu_xuat_hang_id`) REFERENCES `phieu_xuat_hang`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tra_lai_hang_ban` ADD CONSTRAINT `tra_lai_hang_ban_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_tra_lai` ADD CONSTRAINT `chi_tiet_tra_lai_tra_lai_id_fkey` FOREIGN KEY (`tra_lai_id`) REFERENCES `tra_lai_hang_ban`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_tra_lai` ADD CONSTRAINT `chi_tiet_tra_lai_so_lo_id_fkey` FOREIGN KEY (`so_lo_id`) REFERENCES `so_lo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_tra_lai` ADD CONSTRAINT `chi_tiet_tra_lai_vi_tri_id_fkey` FOREIGN KEY (`vi_tri_id`) REFERENCES `vi_tri`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_tra_lai` ADD CONSTRAINT `chi_tiet_tra_lai_chi_tiet_phieu_xuat_hang_id_fkey` FOREIGN KEY (`chi_tiet_phieu_xuat_hang_id`) REFERENCES `chi_tiet_phieu_xuat_hang`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doi_tru_chung_tu` ADD CONSTRAINT `doi_tru_chung_tu_phieu_thu_cong_no_id_fkey` FOREIGN KEY (`phieu_thu_cong_no_id`) REFERENCES `phieu_thu_cong_no`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doi_tru_chung_tu` ADD CONSTRAINT `doi_tru_chung_tu_phieu_xuat_hang_id_fkey` FOREIGN KEY (`phieu_xuat_hang_id`) REFERENCES `phieu_xuat_hang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `doi_tru_chung_tu` ADD CONSTRAINT `doi_tru_chung_tu_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written CHECK constraints (not expressible in the Prisma schema)
ALTER TABLE `khach_hang` ADD CONSTRAINT `khach_hang_so_no_toi_da_khong_am` CHECK (`so_no_toi_da` >= 0);
ALTER TABLE `nha_cung_cap` ADD CONSTRAINT `nha_cung_cap_so_no_toi_da_khong_am` CHECK (`so_no_toi_da` >= 0);
ALTER TABLE `doi_tru_chung_tu` ADD CONSTRAINT `doi_tru_so_tien_duong` CHECK (`so_tien_doi_tru` > 0);
ALTER TABLE `chi_tiet_tra_lai` ADD CONSTRAINT `chi_tiet_tra_lai_so_luong_duong` CHECK (`so_luong` > 0 AND `so_luong_co_ban` > 0 AND `he_so_quy_doi` > 0 AND `don_gia` >= 0);
ALTER TABLE `chi_tiet_bao_gia` ADD CONSTRAINT `chi_tiet_bao_gia_so_luong_duong` CHECK (`so_luong` > 0 AND `don_gia` >= 0);
ALTER TABLE `tai_khoan_ngan_hang` ADD CONSTRAINT `tai_khoan_ngan_hang_mot_chu_so_huu` CHECK ((`khach_hang_id` IS NULL) <> (`nha_cung_cap_id` IS NULL));
