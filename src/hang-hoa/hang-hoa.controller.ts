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
import { CreateHangHoaDto } from './dto/create-hang-hoa.dto.js';
import type {
  HangHoaListItemDto,
  HangHoaResponseDto,
} from './dto/hang-hoa-response.dto.js';
import { QueryHangHoaDto } from './dto/query-hang-hoa.dto.js';
import { UpdateHangHoaDto } from './dto/update-hang-hoa.dto.js';
import { HangHoaService } from './hang-hoa.service.js';

@ApiTags('Hàng hóa')
@ApiBearerAuth('access-token')
@Controller('hang-hoa')
export class HangHoaController {
  constructor(private readonly service: HangHoaService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách hàng hóa' })
  findAll(
    @Query() query: QueryHangHoaDto,
    @CurrentUser() viewer: AuthenticatedUser,
  ): Promise<PagedResponse<HangHoaListItemDto>> {
    return this.service.findAll(query, viewer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết hàng hóa kèm các đơn vị quy đổi' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() viewer: AuthenticatedUser,
  ): Promise<HangHoaResponseDto> {
    return this.service.findOne(id, viewer);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({ summary: 'Tạo hàng hóa (kèm đơn vị cơ bản và đơn vị khác)' })
  create(
    @Body() dto: CreateHangHoaDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<HangHoaResponseDto> {
    return this.service.create(dto, actor);
  }

  @Patch(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({ summary: 'Sửa thông tin / giá / ngừng kinh doanh' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHangHoaDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<HangHoaResponseDto> {
    return this.service.update(id, dto, actor);
  }

  @Delete(':id')
  @Roles(ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa hàng hóa chưa phát sinh lô' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
