import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class RedeemVoucherDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  uniqueCode!: string;

  @IsUUID('4', { message: 'branchId không đúng định dạng UUID.' })
  branchId!: string;
}
