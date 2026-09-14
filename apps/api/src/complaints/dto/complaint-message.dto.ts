import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class ComplaintMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
