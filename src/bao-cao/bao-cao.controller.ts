import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ROLE } from '../auth/roles.constants.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import type { PagedResponse } from '../common/pagination/paginate.js';
import {
  BaoCaoKhoService,
  type HanDungResponse,
} from './bao-cao-kho.service.js';
import { BaoCaoKinhDoanhService } from './bao-cao-kinh-doanh.service.js';
import {
  BaoCaoCanDateQueryDto,
  BaoCaoCongNoQueryDto,
  BaoCaoDoanhThuQueryDto,
  BaoCaoHetHanQueryDto,
  BaoCaoNhapXuatTonQueryDto,
  BaoCaoTheoLoQueryDto,
  BaoCaoTonKhoQueryDto,
  BaoCaoTopBanChayQueryDto,
  type BaoCaoCongNoPhaiThuResponseDto,
  type BaoCaoCongNoPhaiTraResponseDto,
  type BaoCaoDoanhThuResponseDto,
  type BaoCaoNhapXuatTonResponseDto,
  type BaoCaoTheoLoItemDto,
  type BaoCaoTonKhoResponseDto,
  type BaoCaoTopBanChayResponseDto,
} from './dto/bao-cao.dto.js';

const FINANCE = [ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN] as const;

// Stock reports are open to every role (warehouse staff do not see cost fields);
// sales, movement and debt reports are for management and accounting.
@ApiTags('Báo cáo')
@ApiBearerAuth('access-token')
@Controller('bao-cao')
export class BaoCaoController {
  constructor(
    private readonly kho: BaoCaoKhoService,
    private readonly kinhDoanh: BaoCaoKinhDoanhService,
  ) {}

  @Get('ton-kho')
  @ApiOperation({ summary: 'Tồn kho hiện tại theo hàng / kho / loại hàng' })
  tonKho(
    @Query() query: BaoCaoTonKhoQueryDto,
    @CurrentUser() viewer: AuthenticatedUser,
  ): Promise<BaoCaoTonKhoResponseDto> {
    return this.kho.tonKho(query, viewer.role?.maRole);
  }

  @Get('ton-kho/theo-lo')
  @ApiOperation({ summary: 'Tồn theo từng lô kèm hạn dùng' })
  tonKhoTheoLo(
    @Query() query: BaoCaoTheoLoQueryDto,
    @CurrentUser() viewer: AuthenticatedUser,
  ): Promise<PagedResponse<BaoCaoTheoLoItemDto>> {
    return this.kho.tonKhoTheoLo(query, viewer.role?.maRole);
  }

  @Get('can-date')
  @ApiOperation({ summary: 'Lô sắp hết hạn còn tồn' })
  canDate(
    @Query() query: BaoCaoCanDateQueryDto,
    @CurrentUser() viewer: AuthenticatedUser,
  ): Promise<HanDungResponse> {
    return this.kho.canDate(query, viewer.role?.maRole);
  }

  @Get('het-han')
  @ApiOperation({ summary: 'Lô đã hết hạn còn tồn' })
  hetHan(
    @Query() query: BaoCaoHetHanQueryDto,
    @CurrentUser() viewer: AuthenticatedUser,
  ): Promise<HanDungResponse> {
    return this.kho.hetHan(query, viewer.role?.maRole);
  }

  @Get('nhap-xuat-ton')
  @Roles(...FINANCE)
  @ApiOperation({ summary: 'Nhập - xuất - tồn theo kỳ (dựng từ sổ biến động)' })
  nhapXuatTon(
    @Query() query: BaoCaoNhapXuatTonQueryDto,
  ): Promise<BaoCaoNhapXuatTonResponseDto> {
    return this.kho.nhapXuatTon(query);
  }

  @Get('doanh-thu')
  @Roles(...FINANCE)
  @ApiOperation({ summary: 'Doanh thu theo kỳ và nhóm' })
  doanhThu(
    @Query() query: BaoCaoDoanhThuQueryDto,
  ): Promise<BaoCaoDoanhThuResponseDto> {
    return this.kinhDoanh.doanhThu(query);
  }

  @Get('top-ban-chay')
  @Roles(...FINANCE)
  @ApiOperation({ summary: 'Hàng bán chạy' })
  topBanChay(
    @Query() query: BaoCaoTopBanChayQueryDto,
  ): Promise<BaoCaoTopBanChayResponseDto> {
    return this.kinhDoanh.topBanChay(query);
  }

  @Get('cong-no-phai-thu')
  @Roles(...FINANCE)
  @ApiOperation({ summary: 'Công nợ phải thu theo tuổi nợ' })
  congNoPhaiThu(
    @Query() query: BaoCaoCongNoQueryDto,
  ): Promise<BaoCaoCongNoPhaiThuResponseDto> {
    return this.kinhDoanh.congNoPhaiThu(query);
  }

  @Get('cong-no-phai-tra')
  @Roles(...FINANCE)
  @ApiOperation({ summary: 'Công nợ phải trả theo tuổi nợ' })
  congNoPhaiTra(
    @Query() query: BaoCaoCongNoQueryDto,
  ): Promise<BaoCaoCongNoPhaiTraResponseDto> {
    return this.kinhDoanh.congNoPhaiTra(query);
  }
}
