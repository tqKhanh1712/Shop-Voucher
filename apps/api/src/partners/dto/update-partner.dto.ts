import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * DTO dữ liệu đầu vào khi đối tác cập nhật hồ sơ doanh nghiệp.
 */
export class UpdatePartnerDto {
  @IsString({ message: 'Tên công ty phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Tên công ty không được để trống.' })
  @IsOptional()
  companyName?: string;

  @IsString({ message: 'Mã số thuế phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Mã số thuế không được để trống.' })
  @IsOptional()
  taxCode?: string;

  @IsString({ message: 'Người đại diện phải là chuỗi ký tự.' })
  @IsOptional()
  representative?: string;
}
