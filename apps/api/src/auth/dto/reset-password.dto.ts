import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'Token không được để trống.' })
  @IsString()
  token: string;

  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống.' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' })
  @MaxLength(128, { message: 'Mật khẩu mới không được vượt quá 128 ký tự.' })
  newPassword: string;
}
