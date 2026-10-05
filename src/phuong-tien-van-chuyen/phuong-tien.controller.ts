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
  CreatePhuongTienDto,
  QueryPhuongTienDto,
  UpdatePhuongTienDto,
  type PhuongTienResponseDto,
} from './dto/phuong-tien.dto.js';
import { PhuongTienService } from './phuong-tien.service.js';

@ApiTags('Phương tiện vận chuyển')
@ApiBearerAuth('access-token')
@Controller('phuong-tien-van-chuyen')
export class PhuongTienController {
  constructor(private readonly service: PhuongTienService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách phương tiện' })
  findAll(
    @Query() query: QueryPhuongTienDto,
  ): Promise<PagedResponse<PhuongTienResponseDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết phương tiện' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PhuongTienResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.NHAN_VIEN_KHO)
  @ApiOperation({ summary: 'Thêm phương tiện' })
  create(@Body() dto: CreatePhuongTienDto): Promise<PhuongTienResponseDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.NHAN_VIEN_KHO)
  @ApiOperation({ summary: 'Sửa / ngừng sử dụng phương tiện' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePhuongTienDto,
  ): Promise<PhuongTienResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa phương tiện chưa dùng' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
