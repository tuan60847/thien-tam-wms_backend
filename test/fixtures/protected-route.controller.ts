import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../src/auth/decorators/roles.decorator.js';

// Used only by e2e tests to exercise @Roles; not part of production code.
@Controller('test-protected')
export class ProtectedRouteController {
  @Roles('ADMIN')
  @Get('admin-only')
  adminOnly(): { ok: true } {
    return { ok: true };
  }
}
