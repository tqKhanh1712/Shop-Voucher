import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class AccountVerificationRequestDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

export class VerifyAccountDto extends AccountVerificationRequestDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'Mã xác thực phải gồm 6 chữ số.' })
  code!: string;
}
