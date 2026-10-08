export interface CodeSpec {
  prefix: string;
  // true: counter resets every Vietnam calendar day and code embeds yyMMdd.
  dated: boolean;
  digits: number;
}

// Document and entity code formats (docs/00-overview/conventions.md section 7).
export const CODE = {
  PHIEU_NHAP: { prefix: 'PN', dated: true, digits: 4 },
  PHIEU_XUAT: { prefix: 'PX', dated: true, digits: 4 },
  PHIEU_THU: { prefix: 'PT', dated: true, digits: 4 },
  PHIEU_THANH_TOAN: { prefix: 'TT', dated: true, digits: 4 },
  KHACH_HANG: { prefix: 'KH', dated: false, digits: 5 },
  NHAN_VIEN: { prefix: 'NV', dated: false, digits: 4 },
  SAN_PHAM: { prefix: 'SP', dated: false, digits: 5 },
  NHA_CUNG_CAP: { prefix: 'NCC', dated: false, digits: 4 },
  NHAN_VIEN_KD: { prefix: 'KD', dated: false, digits: 4 },
} as const satisfies Record<string, CodeSpec>;

// yyMMdd from a YYYY-MM-DD string.
export function toDateKey(dateOnly: string): string {
  return dateOnly.slice(2, 4) + dateOnly.slice(5, 7) + dateOnly.slice(8, 10);
}

export function formatCode(
  spec: CodeSpec,
  sequence: number,
  dateKey: string,
): string {
  const padded = String(sequence).padStart(spec.digits, '0');
  return `${spec.prefix}${spec.dated ? dateKey : ''}${padded}`;
}

// Line codes: <document code>-<nn>.
export function formatLineCode(documentCode: string, index: number): string {
  return `${documentCode}-${String(index).padStart(2, '0')}`;
}
