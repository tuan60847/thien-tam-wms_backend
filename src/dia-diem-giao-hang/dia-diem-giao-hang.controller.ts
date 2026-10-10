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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ROLE } from '../auth/roles.constants.js';
import { DiaDiemGiaoHangService } from './dia-diem-giao-hang.service.js';
import {
  CreateDiaDiemGiaoHangDto,
  UpdateDiaDiemGiaoHangDto,
  type DiaDiemGiaoHangResponseDto,
} from './dto/dia-diem-giao-hang.dto.js';

const WRITERS = [ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN] as const;

@ApiTags('Địa điểm giao hàng')
@ApiBearerAuth('access-token')
@Controller('khach-hang/:khachHangId/dia-diem-giao-hang')
export class DiaDiemGiaoHangController {
  constructor(private readonly service: DiaDiemGiaoHangService) {}

  @Get()
  @ApiOperation({ summary: 'Địa điểm giao hàng của khách (mặc định đứng đầu)' })
  findAll(
    @Param('khachHangId', ParseUUIDPipe) khachHangId: string,
  ): Promise<DiaDiemGiaoHangResponseDto[]> {
    return this.service.findAll(khachHangId);
  }

  @Post()
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Thêm địa điểm giao hàng' })
  create(
    @Param('khachHangId', ParseUUIDPipe) khachHangId: string,
    @Body() dto: CreateDiaDiemGiaoHangDto,
  ): Promise<DiaDiemGiaoHangResponseDto> {
    return this.service.create(khachHangId, dto);
  }

  @Patch(':id')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Sửa địa điểm hoặc đặt làm mặc định' })
  update(
    @Param('khachHangId', ParseUUIDPipe) khachHangId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiaDiemGiaoHangDto,
  ): Promise<DiaDiemGiaoHangResponseDto> {
    return this.service.update(khachHangId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...WRITERS)
  @ApiOperation({
    summary: 'Xóa địa điểm (mặc định chuyển sang địa điểm khác)',
  })
  remove(
    @Param('khachHangId', ParseUUIDPipe) khachHangId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.remove(khachHangId, id);
  }
}
