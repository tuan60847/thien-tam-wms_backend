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
import { CreateTyLeQuyDoiDto } from './dto/create-ty-le-quy-doi.dto.js';
import { QueryTyLeQuyDoiDto } from './dto/query-ty-le-quy-doi.dto.js';
import type { TyLeQuyDoiResponseDto } from './dto/ty-le-quy-doi-response.dto.js';
import { UpdateTyLeQuyDoiDto } from './dto/update-ty-le-quy-doi.dto.js';
import { TyLeQuyDoiService } from './ty-le-quy-doi.service.js';

@ApiTags('Tỷ lệ quy đổi')
@ApiBearerAuth('access-token')
@Controller('hang-hoa/:hangHoaId/ty-le-quy-doi')
export class TyLeQuyDoiController {
  constructor(private readonly service: TyLeQuyDoiService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đơn vị tính của hàng hóa' })
  findAll(
    @Param('hangHoaId', ParseUUIDPipe) hangHoaId: string,
    @Query() query: QueryTyLeQuyDoiDto,
  ): Promise<PagedResponse<TyLeQuyDoiResponseDto>> {
    return this.service.findAll(hangHoaId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết một đơn vị tính' })
  findOne(
    @Param('hangHoaId', ParseUUIDPipe) hangHoaId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TyLeQuyDoiResponseDto> {
    return this.service.findOne(hangHoaId, id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({ summary: 'Thêm đơn vị quy đổi' })
  create(
    @Param('hangHoaId', ParseUUIDPipe) hangHoaId: string,
    @Body() dto: CreateTyLeQuyDoiDto,
  ): Promise<TyLeQuyDoiResponseDto> {
    return this.service.create(hangHoaId, dto);
  }

  @Patch(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({ summary: 'Sửa tên / hệ số (khóa khi hàng đã có lô)' })
  update(
    @Param('hangHoaId', ParseUUIDPipe) hangHoaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTyLeQuyDoiDto,
  ): Promise<TyLeQuyDoiResponseDto> {
    return this.service.update(hangHoaId, id, dto);
  }

  @Delete(':id')
  @Roles(ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa đơn vị (không phải đơn vị cơ bản / đơn vị tính giá)',
  })
  remove(
    @Param('hangHoaId', ParseUUIDPipe) hangHoaId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.remove(hangHoaId, id);
  }
}
