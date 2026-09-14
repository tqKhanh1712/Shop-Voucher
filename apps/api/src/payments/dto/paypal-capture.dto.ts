import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

/**
 * DTO đại diện cho yêu cầu thực hiện Capture giao dịch thanh toán PayPal.
 * Thực hiện xác thực dữ liệu đầu vào lúc runtime.
 */
export class PaypalCaptureDto {
  /**
   * ID đơn hàng do PayPal cấp (còn gọi là token trên Return URL).
   */
  @IsString({ message: 'paypalOrderId phải là một chuỗi ký tự hợp lệ.' })
  @IsNotEmpty({ message: 'paypalOrderId không được để trống.' })
  paypalOrderId: string;

  /**
   * ID giao dịch thanh toán cục bộ trong hệ thống (UUID v4).
   */
  @IsUUID('4', { message: 'paymentId phải là mã định dạng UUID v4 hợp lệ.' })
  @IsNotEmpty({ message: 'paymentId không được để trống.' })
  paymentId: string;
}
