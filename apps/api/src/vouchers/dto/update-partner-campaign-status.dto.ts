import { IsIn } from 'class-validator';
import { VoucherStatus } from '@prisma/client';

export class UpdatePartnerCampaignStatusDto {
  @IsIn([VoucherStatus.APPROVED, VoucherStatus.PAUSED])
  status!: VoucherStatus;
}
