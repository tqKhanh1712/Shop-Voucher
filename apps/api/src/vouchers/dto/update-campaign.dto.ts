import { IsString, IsOptional, IsNumber, IsDateString, IsBoolean, IsArray, Min, ArrayNotEmpty } from 'class-validator';

/**
 * DTO dữ liệu đầu vào khi cập nhật chiến dịch voucher.
 */
export class UpdateCampaignDto {
  @IsString({ message: 'Tiêu đề chiến dịch phải là chuỗi ký tự.' })
  @IsOptional()
  title?: string;

  @IsString({ message: 'Mô tả chi tiết phải là chuỗi ký tự.' })
  @IsOptional()
  description?: string;

  @IsString({ message: 'Điều khoản sử dụng phải là chuỗi ký tự.' })
  @IsOptional()
  termsAndConditions?: string;

  @IsString({ message: 'Đường dẫn ảnh phải là chuỗi ký tự.' })
  @IsOptional()
  thumbnailUrl?: string;

  @IsString({ message: 'Danh mục phải là chuỗi ký tự.' })
  @IsOptional()
  category?: string;

  @IsNumber({}, { message: 'Giá gốc phải là số thực.' })
  @Min(0, { message: 'Giá gốc phải lớn hơn hoặc bằng 0.' })
  @IsOptional()
  originalPrice?: number;

  @IsNumber({}, { message: 'Giá bán phải là số thực.' })
  @Min(0, { message: 'Giá bán phải lớn hơn hoặc bằng 0.' })
  @IsOptional()
  salePrice?: number;

  @IsDateString({}, { message: 'Thời gian bắt đầu bán không đúng định dạng ISO.' })
  @IsOptional()
  saleStartTime?: string;

  @IsDateString({}, { message: 'Thời gian kết thúc bán không đúng định dạng ISO.' })
  @IsOptional()
  saleEndTime?: string;

  @IsDateString({}, { message: 'Thời gian bắt đầu sử dụng không đúng định dạng ISO.' })
  @IsOptional()
  usageStartTime?: string;

  @IsDateString({}, { message: 'Thời gian kết thúc sử dụng không đúng định dạng ISO.' })
  @IsOptional()
  usageEndTime?: string;

  @IsNumber({}, { message: 'Số lượng phát hành phải là số nguyên.' })
  @Min(1, { message: 'Số lượng phát hành phải lớn hơn hoặc bằng 1.' })
  @IsOptional()
  capacity?: number;

  @IsBoolean({ message: 'isMultiUse phải là giá trị Boolean.' })
  @IsOptional()
  isMultiUse?: boolean;

  @IsNumber({}, { message: 'Số lần sử dụng tối đa phải là số nguyên.' })
  @Min(1, { message: 'Số lần sử dụng tối đa phải lớn hơn hoặc bằng 1.' })
  @IsOptional()
  maxUsesPerCode?: number;

  @IsArray({ message: 'Danh sách chi nhánh áp dụng phải là mảng.' })
  @ArrayNotEmpty({ message: 'Chiến dịch phải được áp dụng cho ít nhất một chi nhánh.' })
  @IsString({ each: true, message: 'ID chi nhánh phải là chuỗi ký tự UUID.' })
  @IsOptional()
  branchIds?: string[];
}
