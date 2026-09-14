import { Transform, TransformFnParams, Type } from 'class-transformer';
import { ComplaintPriority, ComplaintStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ComplaintQueryDto {
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
  limit = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyword?: string;

  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;

  @IsOptional()
  @IsEnum(ComplaintPriority)
  priority?: ComplaintPriority;

  @IsOptional()
  @IsUUID('4')
  partnerId?: string;

  @IsOptional()
  @IsUUID('4')
  assignedAdminId?: string;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) => value === 'true')
  @IsBoolean()
  overdue?: boolean;
}
