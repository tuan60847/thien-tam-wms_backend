import type { LoaiBienDong } from '@prisma/client';

// One change to a stock row, in the BASE unit.
export interface StockMove {
  soLoId: string;
  viTriId: string;
  soLuongCoBan: number;
  loai: LoaiBienDong;
  // The document / action that caused it, stored in the movement ledger.
  thamChieu?: { loai: string; id: string };
  lyDo?: string;
  // Reversals (huy_nhap / huy_xuat) may put stock back into a location that has since
  // been switched off; the cold-chain rule still applies.
  boQuaKiemTraViTriHoatDong?: boolean;
}

export interface StockRow {
  id: string;
  soLuong: number;
}
