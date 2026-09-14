import {
  ComplaintMessageVisibility,
  ComplaintPriority,
  ComplaintStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminManageComplaintDto {
  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;

  @IsOptional()
  @IsEnum(ComplaintPriority)
  priority?: ComplaintPriority;

  @IsOptional()
  @IsUUID('4')
  assignedAdminId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  message?: string;

  @IsOptional()
  @IsEnum(ComplaintMessageVisibility)
  visibility: ComplaintMessageVisibility =
    ComplaintMessageVisibility.ALL_PARTIES;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
