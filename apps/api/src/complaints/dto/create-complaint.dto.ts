import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ComplaintType } from '@prisma/client';

export class CreateComplaintDto {
  @IsEnum(ComplaintType)
  @IsNotEmpty()
  type: ComplaintType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description: string;

  @IsUUID()
  @IsOptional()
  orderId?: string;

  @IsUUID()
  @IsOptional()
  campaignId?: string;

  @IsUUID()
  @IsOptional()
  reviewId?: string;

  @IsUUID()
  @IsOptional()
  orderItemId?: string;

  @IsUUID()
  @IsOptional()
  voucherCodeId?: string;
}
