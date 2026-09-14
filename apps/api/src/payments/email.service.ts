import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      this.logger.warn('Chưa cấu hình GMAIL_USER hoặc GMAIL_APP_PASSWORD. Email sẽ không được gửi.');
    }

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: user || '',
        pass: pass || '',
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
    });
  }

  /**
   * Thực hiện gửi email quà tặng bất đồng bộ tới người nhận.
   * @param recipientEmail Email của người nhận quà
   * @param senderName Tên đầy đủ của người tặng quà
   * @param giftMessage Lời chúc đi kèm
   * @param orderCode Mã đơn hàng
   * @param vouchers Danh sách voucher được tặng (tên và mã code)
   */
  async sendGiftEmail(
    recipientEmail: string,
    senderName: string,
    giftMessage: string | null,
    orderCode: string,
    vouchers: { title: string; code: string }[],
  ): Promise<boolean> {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      this.logger.warn('Chưa cấu hình Gmail SMTP, bỏ qua việc gửi email thực tế.');
      return false;
    }

    try {
      const voucherItemsHtml = vouchers
        .map(
          (v) => `
        <div style="background-color: #f9f9f9; padding: 16px; margin-bottom: 12px; border-left: 4px solid #4CAF50; border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">
          <div style="flex: 1; padding-right: 12px;">
            <h4 style="margin: 0 0 6px 0; color: #333; font-size: 15px;">${v.title}</h4>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #E91E63; letter-spacing: 1px;">Mã: ${v.code}</p>
          </div>
          <div style="text-align: center; shrink-0;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(v.code)}" alt="QR Code" style="border: 1px solid #ddd; padding: 4px; border-radius: 4px; background: #fff;" width="100" height="100" />
            <p style="margin: 4px 0 0 0; font-size: 9px; color: #888;">Quét mã tại quầy</p>
          </div>
        </div>
      `,
        )
        .join('');

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #FF4081, #EC407A); padding: 24px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 24px;">🎁 Quà Tặng Voucher Đặc Biệt!</h2>
          </div>
          <div style="padding: 24px; color: #555; line-height: 1.6;">
            <p>Chào bạn,</p>
            <p>Bạn vừa nhận được món quà bất ngờ từ <strong>${senderName}</strong> gửi tặng thông qua hệ thống EC05-Voucher-System!</p>
            
            ${
              giftMessage
                ? `
              <div style="background-color: #FFF3E0; border-left: 4px solid #FF9800; padding: 12px; margin: 16px 0; border-radius: 4px; font-style: italic; color: #E65100;">
                "${giftMessage}"
              </div>
            `
                : ''
            }
            
            <p style="margin-bottom: 16px;">Dưới đây là danh sách mã voucher được gửi tặng:</p>
            ${voucherItemsHtml}
            
            <p style="margin-top: 24px; font-size: 13px; color: #888;">
              *Để sử dụng voucher, bạn vui lòng đưa mã voucher này cho nhân viên đối tác khi thanh toán tại quầy chi nhánh.
            </p>
          </div>
          <div style="background-color: #f1f1f1; padding: 12px; text-align: center; font-size: 12px; color: #888;">
            Đơn hàng liên quan: ${orderCode} | © 2026 Hệ thống Voucher Điện tử EC05
          </div>
        </div>
      `;

      // 1. NẾU CÓ BREVO_API_KEY -> Gửi qua API HTTP của Brevo (Chống rớt mạng trên Railway)
      if (process.env.BREVO_API_KEY) {
        try {
          const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'api-key': process.env.BREVO_API_KEY,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              sender: {
                name: 'VoucherNow Gift',
                email: process.env.BREVO_SENDER_EMAIL || 'tonhannhan223@gmail.com',
              },
              to: [
                {
                  email: recipientEmail,
                },
              ],
              subject: `🎁 Bạn nhận được quà tặng Voucher từ ${senderName}!`,
              htmlContent: htmlContent,
            }),
          });

          if (!response.ok) {
            const errorData = await response.text();
            this.logger.error(`Brevo API Error (Gift Email): ${errorData}`);
            throw new Error('Lỗi từ Brevo API');
          }

          this.logger.log(`[Brevo] Email quà tặng gửi thành công tới ${recipientEmail}.`);
          return true;
        } catch (error: any) {
          this.logger.error(`[Brevo] Gửi email quà tặng thất bại tới ${recipientEmail}: ${error.message}`);
          return false;
        }
      }

      // 2. Rơi về Nodemailer (Chạy Local)
      const mailOptions = {
        from: `"Hệ thống Voucher EC05" <${user}>`,
        to: recipientEmail,
        subject: `🎁 Bạn nhận được quà tặng Voucher từ ${senderName}!`,
        html: htmlContent,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`[Nodemailer] Email quà tặng gửi thành công tới ${recipientEmail}. MessageId: ${info.messageId}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Gửi email quà tặng thất bại tới ${recipientEmail}: ${error.message}`);
      return false;
    }
  }
}
