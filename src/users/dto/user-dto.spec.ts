import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordDto } from './change-password.dto.js';
import { CreateUserDto } from './create-user.dto.js';
import { QueryUserDto } from './query-user.dto.js';
import { ResetPasswordDto } from './reset-password.dto.js';
import { UpdateProfileDto } from './update-profile.dto.js';
import { UpdateUserDto } from './update-user.dto.js';

const UUID = '7d3c9a84-1d3e-4c8d-9b5a-0c2f1e6a9b11';

async function check<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
) {
  const dto = plainToInstance(cls, plain);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: errors.map((e) => e.property).sort() };
}

const valid = {
  username: 'nv01',
  password: 'Matkhau@123',
  hoTen: 'Nguyễn A',
  roleId: UUID,
};

describe('CreateUserDto', () => {
  it('hợp lệ; username và email được chuẩn hóa chữ thường, hoTen được cắt khoảng trắng', async () => {
    const { dto, fields } = await check(CreateUserDto, {
      ...valid,
      username: '  NV01 ',
      email: ' A@B.VN ',
      hoTen: '  An ',
    });
    expect(fields).toEqual([]);
    expect(dto).toMatchObject({
      username: 'nv01',
      email: 'a@b.vn',
      hoTen: 'An',
    });
  });

  it.each([
    ['thiếu username', { username: undefined }, 'username'],
    ['username có khoảng trắng', { username: 'a b c' }, 'username'],
    ['mật khẩu yếu', { password: 'abc' }, 'password'],
    ['hoTen rỗng', { hoTen: '   ' }, 'hoTen'],
    ['hoTen quá 100 ký tự', { hoTen: 'x'.repeat(101) }, 'hoTen'],
    ['email sai', { email: 'khong-phai-email' }, 'email'],
    ['roleId không phải UUID', { roleId: '123' }, 'roleId'],
  ])('từ chối: %s', async (_name, override, field) => {
    const { fields } = await check(CreateUserDto, { ...valid, ...override });
    expect(fields).toContain(field);
  });

  it('từ chối trường thừa (maNV, id)', async () => {
    const { fields } = await check(CreateUserDto, {
      ...valid,
      maNV: 'NV9999',
      id: UUID,
    });
    expect(fields).toEqual(expect.arrayContaining(['maNV', 'id']));
  });
});

describe('UpdateUserDto', () => {
  it('mọi trường tùy chọn; email = null hợp lệ', async () => {
    expect((await check(UpdateUserDto, {})).fields).toEqual([]);
    expect((await check(UpdateUserDto, { email: null })).fields).toEqual([]);
  });

  it.each(['password', 'username', 'maNV'])(
    'không cho sửa %s',
    async (field) => {
      const { fields } = await check(UpdateUserDto, { [field]: 'x' });
      expect(fields).toContain(field);
    },
  );
});

describe('UpdateProfileDto', () => {
  it('chỉ nhận hoTen và email', async () => {
    expect(
      (await check(UpdateProfileDto, { hoTen: 'A', email: 'a@b.vn' })).fields,
    ).toEqual([]);
    expect((await check(UpdateProfileDto, { roleId: UUID })).fields).toContain(
      'roleId',
    );
  });
});

describe('ResetPasswordDto / ChangePasswordDto', () => {
  it('mật khẩu mới phải mạnh', async () => {
    expect(
      (await check(ResetPasswordDto, { newPassword: 'MoiMoi@123' })).fields,
    ).toEqual([]);
    expect(
      (await check(ResetPasswordDto, { newPassword: 'yeu' })).fields,
    ).toContain('newPassword');
    expect(
      (await check(ChangePasswordDto, { oldPassword: 'x', newPassword: 'yeu' }))
        .fields,
    ).toContain('newPassword');
  });

  it('oldPassword bắt buộc', async () => {
    expect(
      (await check(ChangePasswordDto, { newPassword: 'MoiMoi@123' })).fields,
    ).toContain('oldPassword');
  });
});

describe('QueryUserDto', () => {
  it('trangThai nhận "true"/"false" của query string', async () => {
    const { dto, fields } = await check(QueryUserDto, { trangThai: 'false' });
    expect(fields).toEqual([]);
    expect(dto.trangThai).toBe(false);
  });

  it('trangThai sai giá trị và roleId sai UUID bị từ chối', async () => {
    expect(
      (await check(QueryUserDto, { trangThai: 'maybe' })).fields,
    ).toContain('trangThai');
    expect((await check(QueryUserDto, { roleId: 'x' })).fields).toContain(
      'roleId',
    );
  });
});
