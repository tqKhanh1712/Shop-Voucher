import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminCategoryQueryDto {
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
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @Transform(({ value }: TransformFnParams) => value === 'true')
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAdminCategoryDto {
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim().toUpperCase() : (value as unknown),
  )
  @IsString()
  @MaxLength(50)
  @Matches(/^[A-Z0-9]+(?:[_:-][A-Z0-9]+)*$/, {
    message: 'Mã danh mục chỉ gồm chữ, số và dấu _, :, -.',
  })
  code!: string;

  @IsString()
  @MaxLength(100)
  nameVi!: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder = 0;
}

export class UpdateAdminCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameVi?: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
