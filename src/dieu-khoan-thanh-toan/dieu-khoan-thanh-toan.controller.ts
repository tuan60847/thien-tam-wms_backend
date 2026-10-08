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
  CreateDieuKhoanDto,
  QueryDieuKhoanDto,
  UpdateDieuKhoanDto,
  type DieuKhoanResponseDto,
} from './dto/dieu-khoan.dto.js';
import { DieuKhoanThanhToanService } from './dieu-khoan-thanh-toan.service.js';

@ApiTags('Điều khoản thanh toán')
@ApiBearerAuth('access-token')
@Controller('dieu-khoan-thanh-toan')
export class DieuKhoanThanhToanController {
  constructor(private readonly service: DieuKhoanThanhToanService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách điều khoản thanh toán' })
  findAll(
    @Query() query: QueryDieuKhoanDto,
  ): Promise<PagedResponse<DieuKhoanResponseDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết điều khoản' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DieuKhoanResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Tạo điều khoản' })
  create(@Body() dto: CreateDieuKhoanDto): Promise<DieuKhoanResponseDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Sửa điều khoản' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDieuKhoanDto,
  ): Promise<DieuKhoanResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa điều khoản chưa được dùng' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
