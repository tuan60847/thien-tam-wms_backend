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
import type { PhieuXuatResponseDto } from '../phieu-xuat-hang/dto/phieu-xuat.dto.js';
import { BaoGiaService } from './bao-gia.service.js';
import {
  ChuyenPhieuXuatDto,
  CreateBaoGiaDto,
  QueryBaoGiaDto,
  UpdateBaoGiaDto,
  type BaoGiaListItemDto,
  type BaoGiaResponseDto,
} from './dto/bao-gia.dto.js';

const WRITERS = [ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.NHAN_VIEN_KHO] as const;

@ApiTags('Báo giá')
@ApiBearerAuth('access-token')
@Controller('bao-gia')
export class BaoGiaController {
  constructor(private readonly service: BaoGiaService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách báo giá' })
  findAll(
    @Query() query: QueryBaoGiaDto,
  ): Promise<PagedResponse<BaoGiaListItemDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết báo giá kèm dòng và phiếu xuất liên quan',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<BaoGiaResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Lập báo giá' })
  create(
    @Body() dto: CreateBaoGiaDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<BaoGiaResponseDto> {
    return this.service.create(dto, actor);
  }

  @Patch(':id')
  @Roles(...WRITERS)
  @ApiOperation({
    summary:
      'Sửa báo giá chưa chuyển phiếu xuất (gửi chiTiet = thay toàn bộ dòng)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBaoGiaDto,
  ): Promise<BaoGiaResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Xóa báo giá chưa có phiếu xuất' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Post(':id/chuyen-phieu-xuat')
  @Roles(...WRITERS)
  @ApiOperation({
    summary: 'Chuyển báo giá thành phiếu xuất chờ xử lý (chọn lô xuất)',
  })
  convert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChuyenPhieuXuatDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PhieuXuatResponseDto> {
    return this.service.convertToOrder(id, dto, actor);
  }
}
