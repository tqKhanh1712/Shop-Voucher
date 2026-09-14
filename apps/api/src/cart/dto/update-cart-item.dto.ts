import { IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @IsInt({ message: 'Số lượng phải là số nguyên.' })
  @Min(1, { message: 'Số lượng mua phải lớn hơn hoặc bằng 1.' })
  quantity: number;
}
