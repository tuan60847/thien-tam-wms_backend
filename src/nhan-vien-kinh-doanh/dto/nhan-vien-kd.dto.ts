import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { ToBoolean, Trim } from '../../common/transformers.js';
import {
  IsVnPhone,
  NormalizePhone,
} from '../../common/validators/is-vn-phone.js';

export class CreateNhanVienKdDto {
  @ApiProperty({ example: 'Vũ Văn Cường' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  hoTen!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @NormalizePhone()
  @IsVnPhone()
  dienThoai?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Tài khoản đăng nhập tương ứng (nếu có)',
  })
  @IsOptional()
  @IsUUID()
  userId?: string | null;
}

// maNV is generated and never changes.
export class UpdateNhanVienKdDto extends PartialType(CreateNhanVienKdDto) {
  @ApiPropertyOptional({ description: 'false = ngừng hoạt động' })
  @IsOptional()
  @IsBoolean()
  trangThai?: boolean;
}

export class QueryNhanVienKdDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  trangThai?: boolean;
}

export class NhanVienKdResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'KD0001' }) maNV!: string;
  @ApiProperty() hoTen!: string;
  @ApiProperty({ nullable: true, type: String }) dienThoai!: string | null;
  @ApiProperty() trangThai!: boolean;
  @ApiProperty({ nullable: true, type: String }) userId!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
