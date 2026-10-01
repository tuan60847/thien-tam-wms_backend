import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException } from '../../common/errors/app.exception.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../types/authenticated-user.type.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const maRole = user?.role?.maRole;
    if (!maRole || !required.includes(maRole)) {
      throw new AppException('AUTH_FORBIDDEN');
    }
    return true;
  }
}
