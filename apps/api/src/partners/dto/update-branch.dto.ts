import { IsString, IsOptional, IsIn } from 'class-validator';
import { VIETNAM_PROVINCE_CODES } from '../../common/constants/vietnam-provinces';

/**
 * DTO dữ liệu đầu vào khi cập nhật chi nhánh.
 */
export class UpdateBranchDto {
  @IsString({ message: 'Tên chi nhánh phải là chuỗi ký tự.' })
  @IsOptional()
  name?: string;

  @IsString({ message: 'Địa chỉ chi nhánh phải là chuỗi ký tự.' })
  @IsOptional()
  address?: string;

  @IsString({ message: 'Mã tỉnh/thành phải là chuỗi ký tự.' })
  @IsIn(VIETNAM_PROVINCE_CODES, { message: 'Tỉnh/thành phố không hợp lệ.' })
  @IsOptional()
  provinceCode?: string;
}
