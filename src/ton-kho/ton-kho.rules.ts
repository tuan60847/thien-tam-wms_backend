import { AppException } from '../common/errors/app.exception.js';

// Products that must stay cold may only be put in a cold (cap dong) location.
// Normal products in a cold location are allowed (Q-TK-3).
export function assertColdChain(
  hangHoa: { isCanGiuLanh: boolean },
  viTri: { isCapDong: boolean },
): void {
  if (hangHoa.isCanGiuLanh && !viTri.isCapDong) {
    throw new AppException('TON_KHO_COLD_CHAIN_VIOLATION');
  }
}

export interface FefoCandidate {
  soLoId: string;
  viTriId: string;
  hanSuDung: Date;
  soLuong: number;
}

export interface FefoAllocation extends FefoCandidate {
  phanBo: number;
}

// First-Expired-First-Out: earliest expiry first; among equal expiry the row with more
// stock first (fewer pick locations), then id for a stable order. Returns what could be
// allocated and what is still missing - never throws on shortage.
export function allocateFefo(
  candidates: FefoCandidate[],
  needed: number,
): { phanBo: FefoAllocation[]; thieu: number } {
  const sorted = [...candidates]
    .filter((c) => c.soLuong > 0)
    .sort(
      (a, b) =>
        a.hanSuDung.getTime() - b.hanSuDung.getTime() ||
        b.soLuong - a.soLuong ||
        `${a.soLoId}${a.viTriId}`.localeCompare(`${b.soLoId}${b.viTriId}`),
    );
  const phanBo: FefoAllocation[] = [];
  let remaining = needed;
  for (const candidate of sorted) {
    if (remaining <= 0) {
      break;
    }
    const take = Math.min(candidate.soLuong, remaining);
    phanBo.push({ ...candidate, phanBo: take });
    remaining -= take;
  }
  return { phanBo, thieu: Math.max(0, remaining) };
}

export interface LotStockRow {
  hangHoaId: string;
  soLoId: string;
  soLuong: number;
  hanSuDung: Date;
}

export interface ProductStockSummary {
  hangHoaId: string;
  tongTon: number;
  tonKhaDung: number;
  tonCanDate: number;
  tonHetHan: number;
  soLo: number;
}

// Sums stock rows per product, splitting by lot status at `today` (expired = before today).
export function summarizeByProduct(
  rows: LotStockRow[],
  today: Date,
  warnUntil: Date,
): ProductStockSummary[] {
  const byProduct = new Map<
    string,
    ProductStockSummary & { lots: Set<string> }
  >();
  for (const row of rows) {
    const entry = byProduct.get(row.hangHoaId) ?? {
      hangHoaId: row.hangHoaId,
      tongTon: 0,
      tonKhaDung: 0,
      tonCanDate: 0,
      tonHetHan: 0,
      soLo: 0,
      lots: new Set<string>(),
    };
    entry.tongTon += row.soLuong;
    if (row.hanSuDung.getTime() < today.getTime()) {
      entry.tonHetHan += row.soLuong;
    } else {
      entry.tonKhaDung += row.soLuong;
      if (row.hanSuDung.getTime() <= warnUntil.getTime()) {
        entry.tonCanDate += row.soLuong;
      }
    }
    entry.lots.add(row.soLoId);
    entry.soLo = entry.lots.size;
    byProduct.set(row.hangHoaId, entry);
  }
  return [...byProduct.values()].map(({ lots: _lots, ...summary }) => summary);
}
