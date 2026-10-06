import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  ChuyenViTriDto,
  DieuChinhTonKhoDto,
  GoiYXuatQueryDto,
  QueryBienDongDto,
  QueryTonKhoDto,
  QueryTonKhoTongHopDto,
  type BienDongTonKhoResponseDto,
  type ChuyenViTriResponseDto,
  type DoiSoatResponseDto,
  type GoiYXuatResponseDto,
  type TonKhoResponseDto,
  type TonKhoTongHopDto,
} from './dto/ton-kho.dto.js';
import { TonKhoQueryService } from './ton-kho-query.service.js';
import { TonKhoService } from './ton-kho.service.js';

// Static routes are declared before ':id' so they are not captured by it.
@ApiTags('Tồn kho')
@ApiBearerAuth('access-token')
@Controller('ton-kho')
export class TonKhoController {
  constructor(
    private readonly service: TonKhoService,
    private readonly queries: TonKhoQueryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Tồn theo dòng (lô × vị trí)' })
  findAll(
    @Query() query: QueryTonKhoDto,
  ): Promise<PagedResponse<TonKhoResponseDto>> {
    return this.queries.findAll(query);
  }

  @Get('tong-hop')
  @ApiOperation({ summary: 'Tổng hợp tồn theo hàng hóa' })
  tongHop(
    @Query() query: QueryTonKhoTongHopDto,
  ): Promise<PagedResponse<TonKhoTongHopDto>> {
    return this.queries.tongHop(query);
  }

  @Get('goi-y-xuat')
  @ApiOperation({ summary: 'Gợi ý lô xuất theo FEFO (không giữ hàng)' })
  goiYXuat(@Query() query: GoiYXuatQueryDto): Promise<GoiYXuatResponseDto> {
    return this.queries.goiYXuat(query);
  }

  @Get('bien-dong')
  @ApiOperation({ summary: 'Sổ biến động tồn' })
  bienDong(
    @Query() query: QueryBienDongDto,
  ): Promise<PagedResponse<BienDongTonKhoResponseDto>> {
    return this.queries.bienDong(query);
  }

  @Get('doi-soat')
  @Roles(ROLE.ADMIN)
  @ApiOperation({ summary: 'Đối soát tồn với sổ biến động' })
  doiSoat(): Promise<DoiSoatResponseDto> {
    return this.queries.doiSoat();
  }

  @Post('chuyen-vi-tri')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.NHAN_VIEN_KHO)
  @ApiOperation({ summary: 'Chuyển hàng giữa hai vị trí' })
  chuyenViTri(
    @Body() dto: ChuyenViTriDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ChuyenViTriResponseDto> {
    return this.service.chuyenViTri(dto, actor);
  }

  @Post('dieu-chinh')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO)
  @ApiOperation({ summary: 'Điều chỉnh tồn (kiểm kê)' })
  dieuChinh(
    @Body() dto: DieuChinhTonKhoDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TonKhoResponseDto> {
    return this.service.dieuChinh(dto, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Một dòng tồn' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TonKhoResponseDto> {
    return this.queries.findOne(id);
  }
}
