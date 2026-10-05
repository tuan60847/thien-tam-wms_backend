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
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ROLE } from '../auth/roles.constants.js';
import type { PagedResponse } from '../common/pagination/paginate.js';
import {
  CreateViTriDto,
  QueryViTriDto,
  UpdateViTriDto,
  type ViTriResponseDto,
} from './dto/vi-tri.dto.js';
import { ViTriService } from './vi-tri.service.js';

@ApiTags('Vị trí')
@ApiBearerAuth('access-token')
@Controller('vi-tri')
export class ViTriController {
  constructor(private readonly service: ViTriService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách vị trí' })
  findAll(
    @Query() query: QueryViTriDto,
  ): Promise<PagedResponse<ViTriResponseDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết vị trí' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ViTriResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({ summary: 'Tạo vị trí trong kho' })
  create(@Body() dto: CreateViTriDto): Promise<ViTriResponseDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({ summary: 'Sửa / vô hiệu hóa vị trí' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateViTriDto,
  ): Promise<ViTriResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa vị trí chưa từng phát sinh' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
