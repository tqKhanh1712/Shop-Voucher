import { IsUUID, IsInt, Min, IsOptional } from 'class-validator';

export class AddCartItemDto {
  @IsUUID('4', { message: 'ID chiến dịch voucher không hợp lệ.' })
  campaignId: string;

  @IsOptional()
  @IsInt({ message: 'Số lượng phải là số nguyên.' })
  @Min(1, { message: 'Số lượng mua phải lớn hơn hoặc bằng 1.' })
  quantity?: number = 1;
}
