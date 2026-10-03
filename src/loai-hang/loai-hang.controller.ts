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
import { CreateLoaiHangDto } from './dto/create-loai-hang.dto.js';
import type { LoaiHangResponseDto } from './dto/loai-hang-response.dto.js';
import { QueryLoaiHangDto } from './dto/query-loai-hang.dto.js';
import { UpdateLoaiHangDto } from './dto/update-loai-hang.dto.js';
import { LoaiHangService } from './loai-hang.service.js';

@ApiTags('Loại hàng')
@ApiBearerAuth('access-token')
@Controller('loai-hang')
export class LoaiHangController {
  constructor(private readonly service: LoaiHangService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách loại hàng' })
  findAll(
    @Query() query: QueryLoaiHangDto,
  ): Promise<PagedResponse<LoaiHangResponseDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết loại hàng' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LoaiHangResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({ summary: 'Tạo loại hàng' })
  create(@Body() dto: CreateLoaiHangDto): Promise<LoaiHangResponseDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({ summary: 'Sửa / ngừng sử dụng loại hàng' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoaiHangDto,
  ): Promise<LoaiHangResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa loại hàng chưa có hàng hóa' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
