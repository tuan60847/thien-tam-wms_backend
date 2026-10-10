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
  CreatePhieuXuatDto,
  DoiTinhTrangNoDto,
  GiaoHangDto,
  QueryPhieuXuatDto,
  UpdatePhieuXuatDto,
  XuatKhoDto,
  type PhieuXuatListItemDto,
  type PhieuXuatResponseDto,
} from './dto/phieu-xuat.dto.js';
import { PhieuXuatHangService } from './phieu-xuat-hang.service.js';

const WRITERS = [ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.NHAN_VIEN_KHO] as const;

@ApiTags('Phiếu xuất hàng')
@ApiBearerAuth('access-token')
@Controller('phieu-xuat-hang')
export class PhieuXuatHangController {
  constructor(private readonly service: PhieuXuatHangService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách phiếu xuất' })
  findAll(
    @Query() query: QueryPhieuXuatDto,
  ): Promise<PagedResponse<PhieuXuatListItemDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết phiếu xuất kèm dòng, phiếu thu, cảnh báo FEFO',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PhieuXuatResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Lập phiếu xuất (chờ xử lý)' })
  create(
    @Body() dto: CreatePhieuXuatDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    return this.service.create(dto, actor);
  }

  @Patch(':id')
  @Roles(...WRITERS)
  @ApiOperation({
    summary: 'Sửa phiếu chờ xử lý (gửi chiTiet = thay toàn bộ dòng)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePhieuXuatDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    return this.service.update(id, dto, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Xóa phiếu chờ xử lý' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.service.remove(id, actor);
  }

  @Post(':id/xuat-kho')
  @HttpCode(HttpStatus.OK)
  @Roles(...WRITERS)
  @ApiOperation({
    summary:
      'Xuất kho: trừ tồn, phát sinh công nợ (thu_tien_ngay: tự lập phiếu thu)',
  })
  issue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: XuatKhoDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    return this.service.issue(id, dto, actor);
  }

  @Post(':id/giao-hang')
  @HttpCode(HttpStatus.OK)
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Xác nhận đã giao hàng' })
  deliver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GiaoHangDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    return this.service.deliver(id, dto, actor);
  }

  @Patch(':id/tinh-trang-no')
  @Roles(ROLE.ADMIN, ROLE.KE_TOAN)
  @ApiOperation({
    summary: 'Đổi tình trạng nợ (bình thường / khó đòi / không thể đòi)',
  })
  setDebtStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DoiTinhTrangNoDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    return this.service.setDebtStatus(id, dto, actor);
  }

  // NHAN_VIEN_KHO may cancel pending orders only; the service rejects issued ones.
  @Post(':id/huy')
  @HttpCode(HttpStatus.OK)
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Hủy phiếu (chờ xử lý hoặc đã xuất kho)' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HuyPhieuDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    return this.service.cancel(id, dto, actor);
  }
}
