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
import { HuyPhieuDto } from '../common/dto/huy-phieu.dto.js';
import type { PagedResponse } from '../common/pagination/paginate.js';
import {
  CreatePhieuNhapDto,
  QueryPhieuNhapDto,
  UpdatePhieuNhapDto,
  XacNhanNhapDto,
  type PhieuNhapListItemDto,
  type PhieuNhapResponseDto,
} from './dto/phieu-nhap.dto.js';
import { PhieuNhapHangService } from './phieu-nhap-hang.service.js';

@ApiTags('Phiếu nhập hàng')
@ApiBearerAuth('access-token')
@Controller('phieu-nhap-hang')
export class PhieuNhapHangController {
  constructor(private readonly service: PhieuNhapHangService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách phiếu nhập' })
  findAll(
    @Query() query: QueryPhieuNhapDto,
  ): Promise<PagedResponse<PhieuNhapListItemDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết phiếu nhập kèm dòng và thanh toán' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PhieuNhapResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.NHAN_VIEN_KHO)
  @ApiOperation({ summary: 'Lập phiếu nhập (nháp)' })
  create(
    @Body() dto: CreatePhieuNhapDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuNhapResponseDto> {
    return this.service.create(dto, actor);
  }

  @Patch(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.NHAN_VIEN_KHO)
  @ApiOperation({ summary: 'Sửa phiếu nháp (gửi chiTiet = thay toàn bộ dòng)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePhieuNhapDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuNhapResponseDto> {
    return this.service.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.NHAN_VIEN_KHO)
  @ApiOperation({ summary: 'Xóa phiếu nháp' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.service.remove(id, actor);
  }

  @Post(':id/xac-nhan')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({ summary: 'Xác nhận nhập kho, tăng tồn' })
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: XacNhanNhapDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuNhapResponseDto> {
    return this.service.confirm(id, dto, actor);
  }

  // NHAN_VIEN_KHO may cancel drafts only; the service rejects them for received receipts.
  @Post(':id/huy')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.NHAN_VIEN_KHO)
  @ApiOperation({ summary: 'Hủy phiếu (nháp hoặc đã nhập kho)' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HuyPhieuDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuNhapResponseDto> {
    return this.service.cancel(id, dto, actor);
  }
}
