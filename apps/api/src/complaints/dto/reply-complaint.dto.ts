import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { ComplaintStatus } from '@prisma/client';

export class ReplyComplaintDto {
  @IsEnum(ComplaintStatus)
  @IsNotEmpty()
  status: ComplaintStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  resolutionResponse: string;
}
