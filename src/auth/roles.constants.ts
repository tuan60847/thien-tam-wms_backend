// The four fixed roles (docs/03-cross-cutting/permissions.md). maRole values
// match the Role table seeded by prisma/seed.ts.
export const ROLE = {
  ADMIN: 'ADMIN',
  QUAN_LY_KHO: 'QUAN_LY_KHO',
  NHAN_VIEN_KHO: 'NHAN_VIEN_KHO',
  KE_TOAN: 'KE_TOAN',
} as const;

export type RoleCode = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_META: Record<RoleCode, { tenRole: string; moTa: string }> = {
  ADMIN: { tenRole: 'Quản trị viên', moTa: 'Toàn quyền hệ thống' },
  QUAN_LY_KHO: {
    tenRole: 'Quản lý kho',
    moTa: 'Quản lý danh mục kho/hàng, duyệt hủy chứng từ, xem báo cáo',
  },
  NHAN_VIEN_KHO: {
    tenRole: 'Nhân viên kho',
    moTa: 'Nhập, xuất và kiểm kê hàng hóa',
  },
  KE_TOAN: {
    tenRole: 'Kế toán',
    moTa: 'Quản lý công nợ, xem chứng từ và báo cáo tài chính',
  },
};
