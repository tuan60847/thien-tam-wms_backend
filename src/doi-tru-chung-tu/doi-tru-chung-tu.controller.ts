import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { HuyPhieuDto } from '../common/dto/huy-phieu.dto.js';
import type { PagedResponse } from '../common/pagination/paginate.js';
import {
  CreateDoiTruDto,
  QueryDoiTruDto,
  type DoiTruResponseDto,
} from './dto/doi-tru.dto.js';
import { DoiTruChungTuService } from './doi-tru-chung-tu.service.js';

@ApiTags('Đối trừ chứng từ')
@ApiBearerAuth('access-token')
@Controller('doi-tru-chung-tu')
export class DoiTruChungTuController {
  constructor(private readonly service: DoiTruChungTuService) {}

  @Get()
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Danh sách các khoản đối trừ' })
  findAll(
    @Query() query: QueryDoiTruDto,
  ): Promise<PagedResponse<DoiTruResponseDto>> {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles(ROLE.ADMIN, ROLE.QUAN_LY_KHO, ROLE.KE_TOAN)
  @ApiOperation({ summary: 'Chi tiết một khoản đối trừ' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<DoiTruResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(ROLE.ADMIN, ROLE.KE_TOAN)
  @ApiOperation({
    summary:
      'Đối trừ: áp số tiền chưa đối trừ của phiếu thu vào một phiếu xuất',
  })
  create(
    @Body() dto: CreateDoiTruDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<DoiTruResponseDto> {
    return this.service.create(dto, actor);
  }

  @Post(':id/bo')
  @HttpCode(HttpStatus.OK)
  @Roles(ROLE.ADMIN, ROLE.KE_TOAN)
  @ApiOperation({
    summary: 'Bỏ đối trừ: tiền quay về số chưa đối trừ của phiếu thu',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HuyPhieuDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<DoiTruResponseDto> {
    return this.service.remove(id, dto, actor);
  }
}
