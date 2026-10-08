import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ROLE } from '../auth/roles.constants.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { HuyPhieuDto } from '../common/dto/huy-phieu.dto.js';
import type { PagedResponse } from '../common/pagination/paginate.js';
import {
  CongNoKhachQueryDto,
  CreatePhieuThuDto,
  CreateThuGopDto,
  QueryPhieuThuDto,
  type CongNoKhachResponseDto,
  type PhieuThuResponseDto,
} from './dto/phieu-thu.dto.js';
import { PhieuThuCongNoService } from './phieu-thu-cong-no.service.js';

@ApiTags('Phiếu thu công nợ')
@ApiBearerAuth('access-token')
@Controller('phieu-thu-cong-no')
export class PhieuThuCongNoController {
  constructor(private readonly service: PhieuThuCongNoService) {}

  @Get()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Danh sách phiếu thu' })
  findAll(
    @Query() query: QueryPhieuThuDto,
  ): Promise<PagedResponse<PhieuThuResponseDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Chi tiết phiếu thu' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PhieuThuResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Lập phiếu thu cho một phiếu xuất' })
  create(
    @Body() dto: CreatePhieuThuDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuThuResponseDto> {
    return this.service.create(dto, actor);
  }

  @Post('thu-gop')
  @Roles(ROLE.ADMIN, ROLE.KE_TOAN)
  @ApiOperation({
    summary: 'Thu gộp: một phiếu thu cho nhiều phiếu xuất của một khách',
  })
  createThuGop(
    @Body() dto: CreateThuGopDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuThuResponseDto> {
    return this.service.createThuGop(dto, actor);
  }

  @Post(':id/huy')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE.ADMIN, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Hủy phiếu thu (công nợ tăng lại)' })
  voidReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HuyPhieuDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuThuResponseDto> {
    return this.service.voidReceipt(id, dto, actor);
  }
}

// Lives here (not in KhachHangController) so debt logic stays with this module and
// khach-hang does not depend on it.
@ApiTags('Khách hàng')
@ApiBearerAuth('access-token')
@Controller('khach-hang')
export class CongNoKhachHangController {
  constructor(private readonly service: PhieuThuCongNoService) {}

  @Get(':id/cong-no')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Công nợ phải thu của khách hàng' })
  congNo(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CongNoKhachQueryDto,
  ): Promise<CongNoKhachResponseDto> {
    return this.service.congNoKhachHang(id, query);
  }
}
