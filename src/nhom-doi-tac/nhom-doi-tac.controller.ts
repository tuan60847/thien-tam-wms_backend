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
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ROLE } from '../auth/roles.constants.js';
import type { PagedResponse } from '../common/pagination/paginate.js';
import {
  CreateNhomDoiTacDto,
  QueryNhomDoiTacDto,
  UpdateNhomDoiTacDto,
  type NhomDoiTacResponseDto,
} from './dto/nhom-doi-tac.dto.js';
import { NhomDoiTacService } from './nhom-doi-tac.service.js';

@ApiTags('Nhóm khách hàng / NCC')
@ApiBearerAuth('access-token')
@Controller('nhom-doi-tac')
export class NhomDoiTacController {
  constructor(private readonly service: NhomDoiTacService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách nhóm' })
  findAll(
    @Query() query: QueryNhomDoiTacDto,
  ): Promise<PagedResponse<NhomDoiTacResponseDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết nhóm' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NhomDoiTacResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Tạo nhóm' })
  create(@Body() dto: CreateNhomDoiTacDto): Promise<NhomDoiTacResponseDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Sửa nhóm' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNhomDoiTacDto,
  ): Promise<NhomDoiTacResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa nhóm chưa có thành viên' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
