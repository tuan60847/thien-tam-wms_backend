import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { mock } from 'vitest-mock-extended';
import type { AuthenticatedUser } from '../types/authenticated-user.type.js';
import { RolesGuard } from './roles.guard.js';

function userWithRole(maRole: string | null): AuthenticatedUser {
  return {
    id: 'u1',
    maNV: 'NV0001',
    username: 'u',
    hoTen: 'U',
    email: null,
    role: maRole ? { maRole, tenRole: maRole } : null,
  };
}

function setup(required: string[] | undefined, user?: AuthenticatedUser) {
  const reflector = mock<Reflector>();
  reflector.getAllAndOverride.mockReturnValue(required);
  const context = mock<ExecutionContext>();
  context.switchToHttp.mockReturnValue({
    getRequest: () => ({ user }),
  } as ReturnType<ExecutionContext['switchToHttp']>);
  return { guard: new RolesGuard(reflector), context };
}

describe('RolesGuard', () => {
  it('cho qua khi role khớp', () => {
    const { guard, context } = setup(['ADMIN'], userWithRole('ADMIN'));
    expect(guard.canActivate(context)).toBe(true);
  });

  it('cho qua khi role nằm trong danh sách nhiều role', () => {
    const { guard, context } = setup(
      ['ADMIN', 'NHAN_VIEN_KHO'],
      userWithRole('NHAN_VIEN_KHO'),
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('từ chối khi role không khớp', () => {
    const { guard, context } = setup(['ADMIN'], userWithRole('NHAN_VIEN_KHO'));
    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: 'AUTH_FORBIDDEN' }),
    );
  });

  it('cho qua khi không có metadata @Roles', () => {
    const { guard, context } = setup(undefined, undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('từ chối khi có @Roles nhưng thiếu request.user', () => {
    const { guard, context } = setup(['ADMIN'], undefined);
    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: 'AUTH_FORBIDDEN' }),
    );
  });

  it('từ chối khi user không có role', () => {
    const { guard, context } = setup(['ADMIN'], userWithRole(null));
    expect(() => guard.canActivate(context)).toThrow(
      expect.objectContaining({ code: 'AUTH_FORBIDDEN' }),
    );
  });
});
