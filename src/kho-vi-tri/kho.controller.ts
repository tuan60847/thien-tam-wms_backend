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
  CreateKhoDto,
  QueryKhoDto,
  UpdateKhoDto,
  type KhoResponseDto,
} from './dto/kho.dto.js';
import { KhoService } from './kho.service.js';

@ApiTags('Kho')
@ApiBearerAuth('access-token')
@Controller('kho')
export class KhoController {
  constructor(private readonly service: KhoService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách kho' })
  findAll(@Query() query: QueryKhoDto): Promise<PagedResponse<KhoResponseDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết kho' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<KhoResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({ summary: 'Tạo kho' })
  create(@Body() dto: CreateKhoDto): Promise<KhoResponseDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({ summary: 'Sửa / vô hiệu hóa kho' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKhoDto,
  ): Promise<KhoResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa kho không còn vị trí' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
