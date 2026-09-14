import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  IsIn,
  IsInt,
  Max,
} from 'class-validator';
import { VIETNAM_PROVINCE_CODES } from '../../common/constants/vietnam-provinces';

export const CATALOG_VALIDITY_STATUSES = [
  'ALL',
  'AVAILABLE',
  'UPCOMING',
] as const;
export type CatalogValidityStatus = (typeof CATALOG_VALIDITY_STATUSES)[number];

export class PublicCatalogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoryCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @IsOptional()
  @IsString()
  @IsIn(VIETNAM_PROVINCE_CODES, { message: 'Tỉnh/thành phố không hợp lệ.' })
  provinceCode?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortPrice?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDiscount?: 'asc' | 'desc';

  @IsOptional()
  @IsUUID('4')
  partnerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minDiscount?: number;

  @IsOptional()
  @IsString()
  @IsIn(CATALOG_VALIDITY_STATUSES)
  validityStatus?: CatalogValidityStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
