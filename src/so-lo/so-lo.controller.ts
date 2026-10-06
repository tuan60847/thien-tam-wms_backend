import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ROLE } from '../auth/roles.constants.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import type { PagedResponse } from '../common/pagination/paginate.js';
import {
  CreateSoLoDto,
  QuerySoLoDto,
  UpdateSoLoDto,
  type SoLoDetailDto,
  type SoLoResponseDto,
} from './dto/so-lo.dto.js';
import { SoLoService } from './so-lo.service.js';

@ApiTags('Số lô')
@ApiBearerAuth('access-token')
@Controller('so-lo')
export class SoLoController {
  constructor(private readonly service: SoLoService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách lô (lọc theo hạn dùng, còn tồn…)' })
  findAll(
    @Query() query: QuerySoLoDto,
  ): Promise<PagedResponse<SoLoResponseDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết lô kèm tổng tồn' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<SoLoDetailDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.NHAN_VIEN_KHO)
  @ApiOperation({ summary: 'Tạo lô' })
  create(
    @Body() dto: CreateSoLoDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<SoLoResponseDto> {
    return this.service.create(dto, actor);
  }

  @Patch(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({ summary: 'Sửa tên / ngày sản xuất / hạn sử dụng của lô' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSoLoDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<SoLoResponseDto> {
    return this.service.update(id, dto, actor);
  }

  @Delete(':id')
  @Roles(ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa lô chưa phát sinh' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
