import { PartialType } from '@nestjs/swagger';
import { CreateTyLeQuyDoiDto } from './create-ty-le-quy-doi.dto.js';

export class UpdateTyLeQuyDoiDto extends PartialType(CreateTyLeQuyDoiDto) {}
