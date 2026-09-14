import { IsEnum, IsOptional, IsString, MaxLength, IsBoolean, IsEmail, IsArray } from 'class-validator';
import { PaymentProviderType } from '@prisma/client';

export class CheckoutDto {
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự.' })
  @MaxLength(500, { message: 'Ghi chú không được vượt quá 500 ký tự.' })
  recipientNote?: string;

  @IsEnum(PaymentProviderType, { message: 'Cổng thanh toán không hợp lệ (STRIPE, PAYPAL, ZALOPAY, MOMO).' })
  paymentProvider: PaymentProviderType;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái tặng quà phải là boolean.' })
  isGift?: boolean;

  @IsOptional()
  @IsEmail({}, { message: 'Email người nhận không đúng định dạng.' })
  @MaxLength(255)
  recipientEmail?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cartItemIds?: string[];
}

