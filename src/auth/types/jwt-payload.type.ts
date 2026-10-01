export interface JwtPayload {
  sub: string;
  maNV: string;
  roleMa: string | null;
  roleTen: string | null;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}
