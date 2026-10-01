import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AppException } from '../../common/errors/app.exception.js';
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

  // Keep errors from validateUser as-is (e.g. the "account locked" one); a missing
  // token and an invalid/expired one map to different codes.
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false,
    info?: unknown,
  ): TUser {
    if (err) {
      throw err;
    }
    if (!user) {
      const missingToken =
        info instanceof Error && info.message === 'No auth token';
      throw new AppException(
        missingToken ? 'AUTH_UNAUTHORIZED' : 'AUTH_SESSION_INVALID',
      );
    }
    return user;
  }
}
