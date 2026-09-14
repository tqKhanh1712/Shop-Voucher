import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength, IsUUID, Matches } from 'class-validator';

export class CreateStaffDto {
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải chứa ít nhất 8 ký tự.' })
  password: string;

  @IsString()
  fullName: string;

  @IsUUID('4', { message: 'ID chi nhánh không hợp lệ.' })
  branchId: string;

  @IsString({ message: 'Vui lòng nhập số điện thoại.' })
  @MinLength(1, { message: 'Vui lòng nhập số điện thoại.' })
  @Transform(({ value }) => String(value ?? '').trim())
  @Matches(/^\+?[0-9\s\-()]{9,15}$/, { message: 'Số điện thoại không hợp lệ.' })
  phone: string;
}
