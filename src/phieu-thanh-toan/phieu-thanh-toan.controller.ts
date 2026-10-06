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
  CongNoNccQueryDto,
  CreatePhieuThanhToanDto,
  QueryPhieuThanhToanDto,
  type CongNoNccResponseDto,
  type PhieuThanhToanResponseDto,
} from './dto/phieu-thanh-toan.dto.js';
import { PhieuThanhToanService } from './phieu-thanh-toan.service.js';

@ApiTags('Phiếu thanh toán NCC')
@ApiBearerAuth('access-token')
@Controller('phieu-thanh-toan')
export class PhieuThanhToanController {
  constructor(private readonly service: PhieuThanhToanService) {}

  @Get()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Danh sách phiếu thanh toán' })
  findAll(
    @Query() query: QueryPhieuThanhToanDto,
  ): Promise<PagedResponse<PhieuThanhToanResponseDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Chi tiết phiếu thanh toán' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PhieuThanhToanResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Lập phiếu thanh toán cho một phiếu nhập' })
  create(
    @Body() dto: CreatePhieuThanhToanDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuThanhToanResponseDto> {
    return this.service.create(dto, actor);
  }

  @Post(':id/huy')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE.ADMIN, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Hủy phiếu thanh toán (công nợ tăng lại)' })
  voidPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HuyPhieuDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuThanhToanResponseDto> {
    return this.service.voidPayment(id, dto, actor);
  }
}

// Lives here (not in NhaCungCapController) so debt logic stays with the payments module
// and nha-cung-cap does not depend on it.
@ApiTags('Nhà cung cấp')
@ApiBearerAuth('access-token')
@Controller('nha-cung-cap')
export class CongNoNhaCungCapController {
  constructor(private readonly service: PhieuThanhToanService) {}

  @Get(':id/cong-no')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Công nợ phải trả của nhà cung cấp' })
  congNo(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CongNoNccQueryDto,
  ): Promise<CongNoNccResponseDto> {
    return this.service.congNoNhaCungCap(id, query);
  }
}
