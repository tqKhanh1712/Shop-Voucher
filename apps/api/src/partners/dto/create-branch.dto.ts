import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { VIETNAM_PROVINCE_CODES } from '../../common/constants/vietnam-provinces';

/**
 * DTO dữ liệu đầu vào khi tạo chi nhánh mới.
 */
export class CreateBranchDto {
  @IsString({ message: 'Tên chi nhánh phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Tên chi nhánh không được để trống.' })
  name!: string;

  @IsString({ message: 'Địa chỉ chi nhánh phải là chuỗi ký tự.' })
  @IsOptional()
  address?: string;

  @IsString({ message: 'Mã tỉnh/thành phải là chuỗi ký tự.' })
  @IsIn(VIETNAM_PROVINCE_CODES, { message: 'Tỉnh/thành phố không hợp lệ.' })
  provinceCode!: string;
}
