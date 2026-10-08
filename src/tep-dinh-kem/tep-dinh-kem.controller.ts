import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import type { PagedResponse } from '../common/pagination/paginate.js';
import {
  QueryTepDto,
  UploadTepDto,
  type TepDinhKemResponseDto,
} from './dto/tep-dinh-kem.dto.js';
import { MAX_FILE_BYTES } from './tep-dinh-kem.rules.js';
import {
  TepDinhKemService,
  type UploadedBinary,
} from './tep-dinh-kem.service.js';

@ApiTags('Tệp đính kèm')
@ApiBearerAuth('access-token')
@Controller('tep-dinh-kem')
export class TepDinhKemController {
  constructor(private readonly service: TepDinhKemService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tệp đính kèm (metadata)' })
  findAll(
    @Query() query: QueryTepDto,
  ): Promise<PagedResponse<TepDinhKemResponseDto>> {
    return this.service.findAll(query);
  }

  // Quyền ghi phụ thuộc loại đối tượng nên được kiểm trong service.
  @Post()
  @ApiOperation({ summary: 'Tải tệp lên (PDF/JPEG/PNG/WebP, tối đa 10 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'loaiDoiTuong', 'doiTuongId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        loaiDoiTuong: { type: 'string' },
        doiTuongId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  upload(
    @UploadedFile() file: UploadedBinary | undefined,
    @Body() dto: UploadTepDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TepDinhKemResponseDto> {
    return this.service.upload(file, dto, actor);
  }

  @Get(':id/tai-ve')
  @ApiOperation({ summary: 'Tải nội dung tệp' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.service.download(id);
    res.attachment(file.tenFile);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Length', String(file.kichThuoc));
    // The stored type is trusted (checked on upload); stop browsers from guessing another.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(file.stream);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa tệp đính kèm' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.service.remove(id, actor);
  }
}
