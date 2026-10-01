export interface AuthenticatedRole {
  maRole: string;
  tenRole: string;
}

export interface AuthenticatedUser {
  id: string;
  maNV: string;
  username: string;
  hoTen: string;
  email: string | null;
  role: AuthenticatedRole | null;
}
