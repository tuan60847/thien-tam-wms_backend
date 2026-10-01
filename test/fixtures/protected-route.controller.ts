import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../src/auth/decorators/roles.decorator.js';

// Chỉ dùng trong e2e để kiểm tra @Roles, không thuộc code production.
@Controller('test-protected')
export class ProtectedRouteController {
  @Roles('ADMIN')
  @Get('admin-only')
  adminOnly(): { ok: true } {
    return { ok: true };
  }
}
