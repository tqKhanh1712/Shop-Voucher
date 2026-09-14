import { IsEnum, IsOptional } from 'class-validator';
import { PartnerAccountStatus, PartnerApprovalStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class PartnerListQueryDto extends PaginationQueryDto {}

export class AdminPartnerListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PartnerApprovalStatus)
  approvalStatus?: PartnerApprovalStatus;

  @IsOptional()
  @IsEnum(PartnerAccountStatus)
  accountStatus?: PartnerAccountStatus;
}

export enum PartnerPerformanceSortField {
  COMPANY_NAME = 'companyName',
  TOTAL_CAMPAIGNS = 'totalCampaigns',
  VOUCHERS_SOLD = 'vouchersSold',
  REVENUE = 'revenue',
  USAGE_RATE = 'usageRate',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class PartnerPerformanceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PartnerPerformanceSortField)
  sortField = PartnerPerformanceSortField.REVENUE;

  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection = SortDirection.DESC;
}
