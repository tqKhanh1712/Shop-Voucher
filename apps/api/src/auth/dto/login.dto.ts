import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

/**
 * DTO dữ liệu đầu vào cho yêu cầu đăng nhập.
 */
export class LoginDto {
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  @IsOptional()
  email?: string;

  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự.' })
  @IsOptional()
  phone?: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống.' })
  @MinLength(8, { message: 'Mật khẩu phải chứa ít nhất 8 ký tự.' })
  @MaxLength(128, { message: 'Mật khẩu không được vượt quá 128 ký tự.' })
  password!: string;
}
