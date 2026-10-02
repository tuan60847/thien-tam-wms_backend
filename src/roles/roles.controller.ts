import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ROLE } from '../auth/roles.constants.js';
import type { PagedResponse } from '../common/pagination/paginate.js';
import { QueryRoleDto } from './dto/query-role.dto.js';
import type { RoleResponseDto } from './dto/role-response.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { RolesService } from './roles.service.js';

@ApiTags('Vai trò')
@ApiBearerAuth('access-token')
@Roles(ROLE.ADMIN)
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách vai trò' })
  findAll(
    @Query() query: QueryRoleDto,
  ): Promise<PagedResponse<RoleResponseDto>> {
    return this.roles.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết vai trò' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<RoleResponseDto> {
    return this.roles.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sửa tên / mô tả / trạng thái vai trò' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.roles.update(id, dto);
  }
}
