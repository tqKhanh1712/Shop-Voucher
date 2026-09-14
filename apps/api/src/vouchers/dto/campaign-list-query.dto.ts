import { IsEnum, IsOptional } from 'class-validator';
import { VoucherStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CampaignListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(VoucherStatus)
  status?: VoucherStatus;
}
