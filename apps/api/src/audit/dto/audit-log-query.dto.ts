import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ActivityCategory, UserRole } from '@prisma/client';

export class AuditLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID('4')
  actorUserId?: string;

  @IsOptional()
  @IsEnum(UserRole)
  actorRole?: UserRole;

  @IsOptional()
  @IsEnum(ActivityCategory)
  category?: ActivityCategory;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  actionType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetEntity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetId?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort: 'asc' | 'desc' = 'desc';
}
