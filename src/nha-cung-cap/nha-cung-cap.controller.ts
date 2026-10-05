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
  CreateNhaCungCapDto,
  QueryNhaCungCapDto,
  UpdateNhaCungCapDto,
  XacMinhNhaCungCapDto,
  type NhaCungCapResponseDto,
} from './dto/nha-cung-cap.dto.js';
import { NhaCungCapService } from './nha-cung-cap.service.js';

@ApiTags('Nhà cung cấp')
@ApiBearerAuth('access-token')
@Controller('nha-cung-cap')
export class NhaCungCapController {
  constructor(private readonly service: NhaCungCapService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách nhà cung cấp' })
  findAll(
    @Query() query: QueryNhaCungCapDto,
  ): Promise<PagedResponse<NhaCungCapResponseDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết nhà cung cấp' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NhaCungCapResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Tạo nhà cung cấp (mặc định chưa xác minh)' })
  create(
    @Body() dto: CreateNhaCungCapDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<NhaCungCapResponseDto> {
    return this.service.create(dto, actor);
  }

  @Patch(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Sửa / ngừng hoạt động nhà cung cấp' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNhaCungCapDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<NhaCungCapResponseDto> {
    return this.service.update(id, dto, actor);
  }

  @Post(':id/xac-minh')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác minh hoặc từ chối nhà cung cấp' })
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: XacMinhNhaCungCapDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<NhaCungCapResponseDto> {
    return this.service.verify(id, dto, actor);
  }

  @Delete(':id')
  @Roles(ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa nhà cung cấp chưa có phiếu nhập' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
