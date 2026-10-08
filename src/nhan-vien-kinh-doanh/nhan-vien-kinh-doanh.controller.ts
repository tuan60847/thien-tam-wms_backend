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
  CreateNhanVienKdDto,
  QueryNhanVienKdDto,
  UpdateNhanVienKdDto,
  type NhanVienKdResponseDto,
} from './dto/nhan-vien-kd.dto.js';
import { NhanVienKinhDoanhService } from './nhan-vien-kinh-doanh.service.js';

@ApiTags('Nhân viên kinh doanh')
@ApiBearerAuth('access-token')
@Controller('nhan-vien-kinh-doanh')
export class NhanVienKinhDoanhController {
  constructor(private readonly service: NhanVienKinhDoanhService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách nhân viên kinh doanh' })
  findAll(
    @Query() query: QueryNhanVienKdDto,
  ): Promise<PagedResponse<NhanVienKdResponseDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết nhân viên' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NhanVienKdResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Tạo nhân viên kinh doanh' })
  create(@Body() dto: CreateNhanVienKdDto): Promise<NhanVienKdResponseDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Sửa / ngừng hoạt động nhân viên' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNhanVienKdDto,
  ): Promise<NhanVienKdResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa nhân viên chưa phát sinh dữ liệu' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
