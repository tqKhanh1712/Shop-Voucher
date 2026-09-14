import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as dns from 'node:dns';
dotenv.config({ path: path.join(__dirname, '../../.env') }); // Ensure exact path relative to this file

// Force Node.js to prefer IPv4 over IPv6 for DNS resolution
// This prevents ENETUNREACH errors on networks with broken IPv6 routing
dns.setDefaultResultOrder('ipv4first');

export interface PasswordResetDelivery {
  email: string;
  resetUrl: string;
  expiresAt: Date;
}

@Injectable()
export class PasswordResetDeliveryService {
  private readonly logger = new Logger(PasswordResetDeliveryService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    // Không đọc process.env ở đây vì ConfigModule có thể chưa load xong
  }

  async deliver(delivery: PasswordResetDelivery): Promise<void> {
    const { email, resetUrl, expiresAt } = delivery;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #f97316; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">VoucherNow</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <h2 style="color: #1f2937; margin-top: 0;">Xin chào,</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với email này.
            Vui lòng nhấp vào nút bên dưới để tạo mật khẩu mới.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Đặt Lại Mật Khẩu
            </a>
          </div>
          <p style="color: #4b5563; line-height: 1.6; font-size: 14px;">
            Liên kết này sẽ hết hạn vào lúc: <strong>${expiresAt.toLocaleString('vi-VN')}</strong>.
            <br><br>
            Nếu bạn không yêu cầu đặt lại mật khẩu, xin vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.
          </p>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
          © ${new Date().getFullYear()} VoucherNow. Mọi quyền được bảo lưu.
        </div>
      </div>
    `;

    // 1. NẾU CÓ BREVO_API_KEY -> Gửi qua API HTTP của Brevo (Cho phép gửi đến mọi email)
    if (process.env.BREVO_API_KEY) {
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: {
              name: 'VoucherNow Support',
              email:
                process.env.BREVO_SENDER_EMAIL || 'tonhannhan223@gmail.com', // Cố định luôn email này để lỡ GMAIL_USER khác email đăng ký Brevo
            },
            to: [
              {
                email: email, // Bây giờ có thể gửi cho BẤT KỲ AI!
              },
            ],
            subject: 'Yêu cầu đặt lại mật khẩu - VoucherNow',
            htmlContent: htmlContent,
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          this.logger.error(`Brevo API Error: ${errorData}`);
          throw new Error('Lỗi từ Brevo API');
        }

        this.logger.log(
          `[Brevo] Đã gửi email khôi phục thành công đến: ${email}`,
        );
        return; // Gửi thành công, kết thúc hàm
      } catch (error) {
        this.logger.error(`[Brevo] Lỗi khi gửi email đến ${email}:`, error);
        throw new Error('Không thể gửi email qua Brevo. Vui lòng thử lại sau.');
      }
    }

    // 2. NẾU CÓ RESEND_API_KEY -> Gửi qua API HTTP của Resend (Dự phòng)
    if (process.env.RESEND_API_KEY) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'VoucherNow <onboarding@resend.dev>',
            to: email, // LƯU Ý: Ở gói Free, email nhận PHẢI LÀ email bạn đăng ký tài khoản Resend
            subject: 'Yêu cầu đặt lại mật khẩu - VoucherNow',
            html: htmlContent,
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          this.logger.error(`Resend API Error: ${errorData}`);
          throw new Error('Lỗi từ Resend API');
        }

        this.logger.log(
          `[Resend] Đã gửi email khôi phục thành công đến: ${email}`,
        );
        return; // Gửi thành công, kết thúc hàm
      } catch (error) {
        this.logger.error(`[Resend] Lỗi khi gửi email đến ${email}:`, error);
        throw new Error(
          'Không thể gửi email qua Resend. Vui lòng thử lại sau.',
        );
      }
    }

    // 3. NẾU KHÔNG CÓ CẢ 2 -> Rơi về Nodemailer (Chạy Local)
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      throw new Error(
        'Tính năng gửi email chưa được cấu hình (Thiếu BREVO_API_KEY hoặc GMAIL_USER/GMAIL_APP_PASSWORD).',
      );
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
      });
    }

    const mailOptions = {
      from: `"VoucherNow Support" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Yêu cầu đặt lại mật khẩu - VoucherNow',
      html: htmlContent,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `[Nodemailer] Đã gửi email khôi phục thành công đến: ${email}`,
      );
    } catch (error) {
      this.logger.error(`[Nodemailer] Lỗi khi gửi email đến ${email}:`, error);
      throw new Error('Không thể gửi email. Vui lòng thử lại sau.');
    }
  }
}
