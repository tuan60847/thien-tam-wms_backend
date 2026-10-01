import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthenticatedUser } from '../types/authenticated-user.type.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  // Giữ nguyên lỗi từ validateUser (ví dụ "Tài khoản đã bị khóa").
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false,
  ): TUser {
    if (err) {
      throw err;
    }
    if (!user) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    return user;
  }
}
