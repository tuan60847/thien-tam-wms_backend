import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ROLE } from '../auth/roles.constants.js';
import { AuditService } from './audit.service.js';
import { QueryAuditDto } from './dto/query-audit.dto.js';

@ApiTags('Nhật ký')
@ApiBearerAuth('access-token')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles(ROLE.ADMIN)
  @ApiOperation({ summary: 'Xem nhật ký thao tác hệ thống' })
  findAll(@Query() query: QueryAuditDto) {
    return this.audit.findAll(query);
  }
}
