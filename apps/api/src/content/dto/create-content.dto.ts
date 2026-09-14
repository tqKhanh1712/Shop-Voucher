import { ContentStatus, ContentType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateContentDto {
  @IsEnum(ContentType)
  type!: ContentType;

  @IsString()
  @MaxLength(150)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug chỉ gồm chữ thường, số và dấu gạch ngang.',
  })
  slug!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  body?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  imageUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2000)
  linkUrl?: string;

  @IsOptional()
  @IsEnum(ContentStatus)
  status: ContentStatus = ContentStatus.DRAFT;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder = 0;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
