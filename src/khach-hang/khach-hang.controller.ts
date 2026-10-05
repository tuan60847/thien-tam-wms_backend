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
import {
  CreateKhachHangDto,
  QueryKhachHangDto,
  UpdateKhachHangDto,
  type KhachHangResponseDto,
} from './dto/khach-hang.dto.js';
import { KhachHangService } from './khach-hang.service.js';

@ApiTags('Khách hàng')
@ApiBearerAuth('access-token')
@Controller('khach-hang')
export class KhachHangController {
  constructor(private readonly service: KhachHangService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách khách hàng' })
  findAll(
    @Query() query: QueryKhachHangDto,
  ): Promise<PagedResponse<KhachHangResponseDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết khách hàng' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<KhachHangResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Tạo khách hàng' })
  create(
    @Body() dto: CreateKhachHangDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<KhachHangResponseDto> {
    return this.service.create(dto, actor);
  }

  @Patch(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Sửa / ngừng hoạt động khách hàng' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKhachHangDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<KhachHangResponseDto> {
    return this.service.update(id, dto, actor);
  }

  @Delete(':id')
  @Roles(ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa khách hàng chưa có phiếu xuất' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
