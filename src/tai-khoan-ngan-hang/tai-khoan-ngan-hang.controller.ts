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
import {
  CreateTaiKhoanNganHangDto,
  UpdateTaiKhoanNganHangDto,
  type TaiKhoanNganHangResponseDto,
} from './dto/tai-khoan-ngan-hang.dto.js';
import { TaiKhoanNganHangService } from './tai-khoan-ngan-hang.service.js';

const WRITERS = [ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN] as const;

@ApiTags('Tài khoản ngân hàng')
@ApiBearerAuth('access-token')
@Controller('khach-hang/:khachHangId/tai-khoan-ngan-hang')
export class KhachHangNganHangController {
  constructor(private readonly service: TaiKhoanNganHangService) {}

  @Get()
  @ApiOperation({ summary: 'Tài khoản ngân hàng của khách hàng' })
  findAll(
    @Param('khachHangId', ParseUUIDPipe) khachHangId: string,
  ): Promise<TaiKhoanNganHangResponseDto[]> {
    return this.service.findAll({ khachHangId });
  }

  @Post()
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Thêm tài khoản ngân hàng cho khách hàng' })
  create(
    @Param('khachHangId', ParseUUIDPipe) khachHangId: string,
    @Body() dto: CreateTaiKhoanNganHangDto,
  ): Promise<TaiKhoanNganHangResponseDto> {
    return this.service.create({ khachHangId }, dto);
  }

  @Patch(':id')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Sửa tài khoản ngân hàng của khách hàng' })
  update(
    @Param('khachHangId', ParseUUIDPipe) khachHangId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaiKhoanNganHangDto,
  ): Promise<TaiKhoanNganHangResponseDto> {
    return this.service.update({ khachHangId }, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Xóa tài khoản ngân hàng của khách hàng' })
  remove(
    @Param('khachHangId', ParseUUIDPipe) khachHangId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.remove({ khachHangId }, id);
  }
}

@ApiTags('Tài khoản ngân hàng')
@ApiBearerAuth('access-token')
@Controller('nha-cung-cap/:nhaCungCapId/tai-khoan-ngan-hang')
export class NhaCungCapNganHangController {
  constructor(private readonly service: TaiKhoanNganHangService) {}

  @Get()
  @ApiOperation({ summary: 'Tài khoản ngân hàng của nhà cung cấp' })
  findAll(
    @Param('nhaCungCapId', ParseUUIDPipe) nhaCungCapId: string,
  ): Promise<TaiKhoanNganHangResponseDto[]> {
    return this.service.findAll({ nhaCungCapId });
  }

  @Post()
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Thêm tài khoản ngân hàng cho nhà cung cấp' })
  create(
    @Param('nhaCungCapId', ParseUUIDPipe) nhaCungCapId: string,
    @Body() dto: CreateTaiKhoanNganHangDto,
  ): Promise<TaiKhoanNganHangResponseDto> {
    return this.service.create({ nhaCungCapId }, dto);
  }

  @Patch(':id')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Sửa tài khoản ngân hàng của nhà cung cấp' })
  update(
    @Param('nhaCungCapId', ParseUUIDPipe) nhaCungCapId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaiKhoanNganHangDto,
  ): Promise<TaiKhoanNganHangResponseDto> {
    return this.service.update({ nhaCungCapId }, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Xóa tài khoản ngân hàng của nhà cung cấp' })
  remove(
    @Param('nhaCungCapId', ParseUUIDPipe) nhaCungCapId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.remove({ nhaCungCapId }, id);
  }
}
