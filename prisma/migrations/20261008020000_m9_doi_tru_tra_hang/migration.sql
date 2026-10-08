-- AlterTable
ALTER TABLE `bien_dong_ton_kho` MODIFY `loai` ENUM('nhap_kho', 'xuat_kho', 'huy_nhap', 'huy_xuat', 'chuyen_di', 'chuyen_den', 'dieu_chinh', 'tra_hang') NOT NULL;


-- Data backfill: from now on the amount an order has received is the sum of its effective
-- allocations (doi_tru_chung_tu). Every receipt created before this migration paid exactly
-- the order it was attached to, so it becomes one allocation of its full amount.
INSERT INTO `doi_tru_chung_tu`
  (`id`, `ngay_doi_tru`, `so_tien_doi_tru`, `da_bo_doi_tru`, `created_at`, `phieu_thu_cong_no_id`, `phieu_xuat_hang_id`, `created_by_id`)
SELECT UUID(), `ngay_thanh_toan`, `so_tien`, (`huy_at` IS NOT NULL), `created_at`, `id`, `phieu_xuat_hang_id`, `created_by_id`
FROM `phieu_thu_cong_no`;
