-- CreateTable
CREATE TABLE `role` (
    `id` VARCHAR(191) NOT NULL,
    `ma_role` VARCHAR(191) NOT NULL,
    `ten_role` VARCHAR(191) NOT NULL,
    `mo_ta` VARCHAR(191) NULL,
    `trang_thai` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `role_ma_role_key`(`ma_role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `ma_nv` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `ho_ten` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `trang_thai` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `role_id` VARCHAR(191) NULL,

    UNIQUE INDEX `user_ma_nv_key`(`ma_nv`),
    UNIQUE INDEX `user_username_key`(`username`),
    UNIQUE INDEX `user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_token` (
    `id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `refresh_token_token_hash_key`(`token_hash`),
    INDEX `refresh_token_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loai_hang` (
    `id` VARCHAR(191) NOT NULL,
    `ten_loai_hang` VARCHAR(191) NOT NULL,
    `ghi_chu` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hang_hoa` (
    `id` VARCHAR(191) NOT NULL,
    `ten_sp` VARCHAR(191) NOT NULL,
    `quy_cach` VARCHAR(191) NULL,
    `gia_nhap` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `gia_hien_thi` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `gia_toi_thieu` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `is_ke_don` BOOLEAN NOT NULL DEFAULT false,
    `is_can_giu_lanh` BOOLEAN NOT NULL DEFAULT false,
    `loai_kiem_soat` VARCHAR(191) NULL,
    `so_dang_ky` VARCHAR(191) NULL,
    `ghi_chu` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `loai_hang_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ty_le_quy_doi` (
    `id` VARCHAR(191) NOT NULL,
    `don_vi_tinh` VARCHAR(191) NOT NULL,
    `so_luong_quy_doi` INTEGER NOT NULL,
    `hang_hoa_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `so_lo` (
    `id` VARCHAR(191) NOT NULL,
    `ten_lo` VARCHAR(191) NOT NULL,
    `ngay_sx` DATETIME(3) NULL,
    `han_su_dung` DATETIME(3) NOT NULL,
    `trang_thai` VARCHAR(191) NOT NULL DEFAULT 'con_han',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `hang_hoa_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kho` (
    `id` VARCHAR(191) NOT NULL,
    `ten_kho` VARCHAR(191) NOT NULL,
    `dia_chi` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vi_tri` (
    `id` VARCHAR(191) NOT NULL,
    `ten_vi_tri` VARCHAR(191) NOT NULL,
    `is_cap_dong` BOOLEAN NOT NULL DEFAULT false,
    `ghi_chu` VARCHAR(191) NULL,
    `kho_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ton_kho` (
    `id` VARCHAR(191) NOT NULL,
    `so_luong` INTEGER NOT NULL DEFAULT 0,
    `so_lo_id` VARCHAR(191) NOT NULL,
    `vi_tri_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `ton_kho_so_lo_id_vi_tri_id_key`(`so_lo_id`, `vi_tri_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `khach_hang` (
    `id` VARCHAR(191) NOT NULL,
    `ma_kh` VARCHAR(191) NOT NULL,
    `ten_kh` VARCHAR(191) NOT NULL,
    `dia_chi` VARCHAR(191) NULL,
    `ma_so_thue` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `SDT` VARCHAR(191) NULL,
    `nguoi_dai_dien` VARCHAR(191) NULL,
    `sdt_ndd` VARCHAR(191) NULL,
    `trang_thai` VARCHAR(191) NOT NULL DEFAULT 'hoat_dong',
    `so_giay_phep_kinh_doanh` VARCHAR(191) NULL,
    `ngay_cap_gpkd` DATETIME(3) NULL,
    `ngay_het_han_gpkd` DATETIME(3) NULL,

    UNIQUE INDEX `khach_hang_ma_kh_key`(`ma_kh`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nha_cung_cap` (
    `id` VARCHAR(191) NOT NULL,
    `ten_ncc` VARCHAR(191) NOT NULL,
    `SDT` VARCHAR(191) NULL,
    `dia_chi` VARCHAR(191) NULL,
    `ten_nguoi_phu_trach` VARCHAR(191) NULL,
    `sdt_nguoi_pt` VARCHAR(191) NULL,
    `trang_thai_xac_minh` VARCHAR(191) NOT NULL DEFAULT 'chua_xac_minh',
    `ghi_chu` VARCHAR(191) NULL,
    `so_giay_phep_kinh_doanh` VARCHAR(191) NULL,
    `ngay_cap_gpkd` DATETIME(3) NULL,
    `noi_cap_gpkd` VARCHAR(191) NULL,
    `so_gcn_du_dieu_kien_kinh_doanh_duoc` VARCHAR(191) NULL,
    `ngay_cap_gcn_duoc` DATETIME(3) NULL,
    `noi_cap_gcn_duoc` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phuong_tien_van_chuyen` (
    `id` VARCHAR(191) NOT NULL,
    `bien_so` VARCHAR(191) NOT NULL,
    `loai_phuong_tien` VARCHAR(191) NULL,

    UNIQUE INDEX `phuong_tien_van_chuyen_bien_so_key`(`bien_so`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phieu_nhap_hang` (
    `id` VARCHAR(191) NOT NULL,
    `ma_phieu_nhap_hang` VARCHAR(191) NOT NULL,
    `ngay_nhan_hang` DATETIME(3) NULL,
    `trang_thai` VARCHAR(191) NOT NULL DEFAULT 'cho_xac_nhan',
    `create_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `nha_cung_cap_id` VARCHAR(191) NOT NULL,
    `phuong_tien_van_chuyen_id` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NULL,

    UNIQUE INDEX `phieu_nhap_hang_ma_phieu_nhap_hang_key`(`ma_phieu_nhap_hang`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chi_tiet_phieu_nhap_hang` (
    `id` VARCHAR(191) NOT NULL,
    `ma_chi_tiet_phieu_nhap_hang` VARCHAR(191) NOT NULL,
    `so_luong` INTEGER NOT NULL,
    `don_gia` DECIMAL(15, 2) NOT NULL,
    `phieu_nhap_hang_id` VARCHAR(191) NOT NULL,
    `so_lo_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `chi_tiet_phieu_nhap_hang_ma_chi_tiet_phieu_nhap_hang_key`(`ma_chi_tiet_phieu_nhap_hang`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phieu_xuat_hang` (
    `id` VARCHAR(191) NOT NULL,
    `ma_phieu_xuat_hang` VARCHAR(191) NOT NULL,
    `ngay_giao_hang` DATETIME(3) NULL,
    `dia_chi_giao_hang` VARCHAR(191) NULL,
    `trang_thai` VARCHAR(191) NOT NULL DEFAULT 'cho_xu_ly',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `khach_hang_id` VARCHAR(191) NOT NULL,
    `created_by_id` VARCHAR(191) NULL,

    UNIQUE INDEX `phieu_xuat_hang_ma_phieu_xuat_hang_key`(`ma_phieu_xuat_hang`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chi_tiet_phieu_xuat_hang` (
    `id` VARCHAR(191) NOT NULL,
    `ma_chi_tiet_phieu_xuat_hang` VARCHAR(191) NOT NULL,
    `so_luong` INTEGER NOT NULL,
    `don_gia` DECIMAL(15, 2) NOT NULL,
    `phieu_xuat_hang_id` VARCHAR(191) NOT NULL,
    `so_lo_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `chi_tiet_phieu_xuat_hang_ma_chi_tiet_phieu_xuat_hang_key`(`ma_chi_tiet_phieu_xuat_hang`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phieu_thu_cong_no` (
    `id` VARCHAR(191) NOT NULL,
    `ma_phieu_thu_cong_no` VARCHAR(191) NOT NULL,
    `so_tien` DECIMAL(15, 2) NOT NULL,
    `ngay_thanh_toan` DATETIME(3) NOT NULL,
    `phieu_xuat_hang_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `phieu_thu_cong_no_ma_phieu_thu_cong_no_key`(`ma_phieu_thu_cong_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phieu_thanh_toan` (
    `id` VARCHAR(191) NOT NULL,
    `ma_phieu_thanh_toan` VARCHAR(191) NOT NULL,
    `so_tien` DECIMAL(15, 2) NOT NULL,
    `ngay_thanh_toan` DATETIME(3) NOT NULL,
    `phieu_nhap_hang_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `phieu_thanh_toan_ma_phieu_thanh_toan_key`(`ma_phieu_thanh_toan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_token` ADD CONSTRAINT `refresh_token_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hang_hoa` ADD CONSTRAINT `hang_hoa_loai_hang_id_fkey` FOREIGN KEY (`loai_hang_id`) REFERENCES `loai_hang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ty_le_quy_doi` ADD CONSTRAINT `ty_le_quy_doi_hang_hoa_id_fkey` FOREIGN KEY (`hang_hoa_id`) REFERENCES `hang_hoa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `so_lo` ADD CONSTRAINT `so_lo_hang_hoa_id_fkey` FOREIGN KEY (`hang_hoa_id`) REFERENCES `hang_hoa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vi_tri` ADD CONSTRAINT `vi_tri_kho_id_fkey` FOREIGN KEY (`kho_id`) REFERENCES `kho`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ton_kho` ADD CONSTRAINT `ton_kho_so_lo_id_fkey` FOREIGN KEY (`so_lo_id`) REFERENCES `so_lo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ton_kho` ADD CONSTRAINT `ton_kho_vi_tri_id_fkey` FOREIGN KEY (`vi_tri_id`) REFERENCES `vi_tri`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_nhap_hang` ADD CONSTRAINT `phieu_nhap_hang_nha_cung_cap_id_fkey` FOREIGN KEY (`nha_cung_cap_id`) REFERENCES `nha_cung_cap`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_nhap_hang` ADD CONSTRAINT `phieu_nhap_hang_phuong_tien_van_chuyen_id_fkey` FOREIGN KEY (`phuong_tien_van_chuyen_id`) REFERENCES `phuong_tien_van_chuyen`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_nhap_hang` ADD CONSTRAINT `phieu_nhap_hang_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_phieu_nhap_hang` ADD CONSTRAINT `chi_tiet_phieu_nhap_hang_phieu_nhap_hang_id_fkey` FOREIGN KEY (`phieu_nhap_hang_id`) REFERENCES `phieu_nhap_hang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_phieu_nhap_hang` ADD CONSTRAINT `chi_tiet_phieu_nhap_hang_so_lo_id_fkey` FOREIGN KEY (`so_lo_id`) REFERENCES `so_lo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_xuat_hang` ADD CONSTRAINT `phieu_xuat_hang_khach_hang_id_fkey` FOREIGN KEY (`khach_hang_id`) REFERENCES `khach_hang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_xuat_hang` ADD CONSTRAINT `phieu_xuat_hang_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_phieu_xuat_hang` ADD CONSTRAINT `chi_tiet_phieu_xuat_hang_phieu_xuat_hang_id_fkey` FOREIGN KEY (`phieu_xuat_hang_id`) REFERENCES `phieu_xuat_hang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chi_tiet_phieu_xuat_hang` ADD CONSTRAINT `chi_tiet_phieu_xuat_hang_so_lo_id_fkey` FOREIGN KEY (`so_lo_id`) REFERENCES `so_lo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_thu_cong_no` ADD CONSTRAINT `phieu_thu_cong_no_phieu_xuat_hang_id_fkey` FOREIGN KEY (`phieu_xuat_hang_id`) REFERENCES `phieu_xuat_hang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `phieu_thanh_toan` ADD CONSTRAINT `phieu_thanh_toan_phieu_nhap_hang_id_fkey` FOREIGN KEY (`phieu_nhap_hang_id`) REFERENCES `phieu_nhap_hang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
