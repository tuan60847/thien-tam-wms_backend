import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { TEST_PASSWORD } from './test-db.js';

export type Tokens = Record<string, string>;

export async function loginAll(
  app: INestApplication<App>,
  usernames: string[],
): Promise<Tokens> {
  const tokens: Tokens = {};
  for (const username of usernames) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password: TEST_PASSWORD })
      .expect(200);
    tokens[username] = (res.body as { accessToken: string }).accessToken;
  }
  return tokens;
}

export const bearer = (tokens: Tokens, user: string) => ({
  Authorization: `Bearer ${tokens[user]}`,
});

export async function createLoaiHang(
  app: INestApplication<App>,
  tokens: Tokens,
  tenLoaiHang: string,
): Promise<{ id: string; tenLoaiHang: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/loai-hang')
    .set(bearer(tokens, 'quanly'))
    .send({ tenLoaiHang })
    .expect(201);
  return res.body as { id: string; tenLoaiHang: string };
}

export interface HangHoaBody {
  id: string;
  maSP: string;
  tenSP: string;
  donViCoBan: string;
  donViTinhGia: string;
  giaNhap?: string;
  giaHienThi: string;
  giaToiThieu?: string;
  tyLeQuyDoi: { id: string; donViTinh: string; soLuongQuyDoi: number }[];
  trangThai: boolean;
  [key: string]: unknown;
}

export async function createHangHoa(
  app: INestApplication<App>,
  tokens: Tokens,
  loaiHangId: string,
  over: Record<string, unknown> = {},
): Promise<HangHoaBody> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/hang-hoa')
    .set(bearer(tokens, 'quanly'))
    .send({
      tenSP: 'Paracetamol 500mg',
      loaiHangId,
      donViCoBan: 'viên',
      cacDonViKhac: [
        { donViTinh: 'vỉ', soLuongQuyDoi: 10 },
        { donViTinh: 'hộp', soLuongQuyDoi: 100 },
      ],
      donViTinhGia: 'hộp',
      giaNhap: '90000',
      giaHienThi: '125000',
      giaToiThieu: '100000',
      ...over,
    })
    .expect(201);
  return res.body as HangHoaBody;
}
