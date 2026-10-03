import { Prisma, type LoaiKiemSoat } from '@prisma/client';
import { AppException } from '../common/errors/app.exception.js';

export interface UnitInput {
  donViTinh: string;
  soLuongQuyDoi: number;
}

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

// Base unit (ratio 1) first, then the others. Names must be unique ignoring case
// and every non-base ratio must be greater than 1.
export function buildUnits(
  base: string,
  others: UnitInput[] = [],
): UnitInput[] {
  const units: UnitInput[] = [{ donViTinh: base.trim(), soLuongQuyDoi: 1 }];
  for (const other of others) {
    if (other.soLuongQuyDoi < 2) {
      throw new AppException('TY_LE_QUY_DOI_BASE_REQUIRED');
    }
    units.push({
      donViTinh: other.donViTinh.trim(),
      soLuongQuyDoi: other.soLuongQuyDoi,
    });
  }
  const seen: string[] = [];
  for (const { donViTinh } of units) {
    if (seen.some((name) => sameName(name, donViTinh))) {
      throw new AppException('TY_LE_QUY_DOI_UNIT_TAKEN');
    }
    seen.push(donViTinh);
  }
  return units;
}

// Canonical spelling of the unit named `name`, or null when the product has no such unit.
export function findUnitName(
  units: { donViTinh: string }[],
  name: string,
): string | null {
  return units.find((u) => sameName(u.donViTinh, name))?.donViTinh ?? null;
}

export function resolvePriceUnit(
  units: { donViTinh: string }[],
  name: string,
): string {
  const found = findUnitName(units, name);
  if (!found) {
    throw new AppException('HANG_HOA_PRICE_UNIT_INVALID');
  }
  return found;
}

// The floor price may not exceed the list price (both per donViTinhGia).
export function assertPriceOrder(
  giaToiThieu: Prisma.Decimal.Value,
  giaHienThi: Prisma.Decimal.Value,
): void {
  if (
    new Prisma.Decimal(giaToiThieu).greaterThan(new Prisma.Decimal(giaHienThi))
  ) {
    throw new AppException('HANG_HOA_PRICE_INVALID');
  }
}

// Prescription / controlled products must declare a control class and a registration number.
export function assertControlType(input: {
  isKeDon: boolean;
  loaiKiemSoat: LoaiKiemSoat | null | undefined;
  soDangKy: string | null | undefined;
}): void {
  const controlled =
    input.loaiKiemSoat === 'ke_don' ||
    input.loaiKiemSoat === 'kiem_soat_dac_biet';
  if (input.isKeDon && !controlled) {
    throw new AppException('HANG_HOA_CONTROL_TYPE_INVALID');
  }
  if ((input.isKeDon || controlled) && !input.soDangKy?.trim()) {
    throw new AppException('HANG_HOA_CONTROL_TYPE_INVALID');
  }
}

// Cost fields are hidden from roles that do not manage money or stock policy.
const CAN_SEE_COST = new Set(['ADMIN', 'QUAN_LY_KHO', 'KE_TOAN']);
export function canSeeCost(maRole: string | null | undefined): boolean {
  return maRole != null && CAN_SEE_COST.has(maRole);
}
