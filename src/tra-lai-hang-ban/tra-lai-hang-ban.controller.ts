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
  CreateTraLaiDto,
  QueryTraLaiDto,
  UpdateTraLaiDto,
  type TraLaiListItemDto,
  type TraLaiResponseDto,
} from './dto/tra-lai.dto.js';
import { TraLaiHangBanService } from './tra-lai-hang-ban.service.js';

const WRITERS = [ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.NHAN_VIEN_KHO] as const;

@ApiTags('Trả lại hàng bán')
@ApiBearerAuth('access-token')
@Controller('tra-lai-hang-ban')
export class TraLaiHangBanController {
  constructor(private readonly service: TraLaiHangBanService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách phiếu trả lại hàng' })
  findAll(
    @Query() query: QueryTraLaiDto,
  ): Promise<PagedResponse<TraLaiListItemDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết phiếu trả lại hàng' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TraLaiResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Lập phiếu trả lại hàng (nháp) cho một phiếu xuất' })
  create(
    @Body() dto: CreateTraLaiDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TraLaiResponseDto> {
    return this.service.create(dto, actor);
  }

  @Patch(':id')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Sửa phiếu nháp (gửi chiTiet = thay toàn bộ dòng)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTraLaiDto,
  ): Promise<TraLaiResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Xóa phiếu nháp' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Post(':id/xac-nhan')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({
    summary: 'Xác nhận: nhập lại kho và giảm công nợ phiếu xuất',
  })
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TraLaiResponseDto> {
    return this.service.confirm(id, actor);
  }

  // NHAN_VIEN_KHO may cancel drafts only; the service rejects received returns for them.
  @Post(':id/huy')
  @HttpCode(HttpStatus.OK)
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Hủy phiếu (nháp hoặc đã nhập lại kho)' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HuyPhieuDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TraLaiResponseDto> {
    return this.service.cancel(id, dto, actor);
  }
}
