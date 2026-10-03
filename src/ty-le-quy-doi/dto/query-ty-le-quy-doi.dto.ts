import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto.js';

// A product has a handful of units, so the default page is larger than usual.
export class QueryTyLeQuyDoiDto extends PaginationQueryDto {
  override pageSize: number = 50;
}
