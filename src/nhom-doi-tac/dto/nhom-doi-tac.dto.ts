import { ApiProperty } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';
import { Trim } from '../../common/transformers.js';

export class CreateNhomDoiTacDto {
  @ApiProperty({ example: 'NHA_THUOC' })
  @Trim()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,20}$/, {
    message: 'Mã nhóm gồm chữ, số, "-" hoặc "_", tối đa 20 ký tự',
  })
  ma!: string;

  @ApiProperty({ example: 'Nhà thuốc' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  ten!: string;
}

export class UpdateNhomDoiTacDto extends PartialType(CreateNhomDoiTacDto) {}

export class QueryNhomDoiTacDto extends PaginationQueryDto {}

export class NhomDoiTacResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() ma!: string;
  @ApiProperty() ten!: string;
  @ApiProperty({ description: 'Số khách hàng thuộc nhóm' })
  soKhachHang!: number;
  @ApiProperty({ description: 'Số nhà cung cấp thuộc nhóm' })
  soNhaCungCap!: number;
}
