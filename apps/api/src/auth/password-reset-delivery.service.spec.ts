import { PasswordResetDeliveryService } from './password-reset-delivery.service';
import * as nodemailer from 'nodemailer';
import { Logger } from '@nestjs/common';

jest.mock('nodemailer');

describe('PasswordResetDeliveryService', () => {
  let service: PasswordResetDeliveryService;
  let mockSendMail: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-msg-id' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
    });

    process.env.GMAIL_USER = 'test@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'password123';
    service = new PasswordResetDeliveryService();
  });

  afterEach(() => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send password reset email successfully with correct options', async () => {
    await expect(
      service.deliver({
        email: 'customer@example.com',
        resetUrl: 'https://frontend.example/reset?token=secret',
        expiresAt: new Date(),
      }),
    ).resolves.toBeUndefined();

    expect(mockSendMail).toHaveBeenCalled();

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.to).toBe('customer@example.com');
    expect(callArgs.subject).toContain('đặt lại mật khẩu');
    expect(callArgs.html).toContain(
      'https://frontend.example/reset?token=secret',
    );
  });

  it('should throw an error when credentials are missing', async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;

    await expect(
      service.deliver({
        email: 'customer@example.com',
        resetUrl: 'https://frontend.example/reset?token=secret',
        expiresAt: new Date(),
      }),
    ).rejects.toThrow('Tính năng gửi email chưa được cấu hình');
  });

  it('should throw an error when nodemailer sendMail throws an error', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP Error'));

    await expect(
      service.deliver({
        email: 'customer@example.com',
        resetUrl: 'https://frontend.example/reset?token=secret',
        expiresAt: new Date(),
      }),
    ).rejects.toThrow('Không thể gửi email. Vui lòng thử lại sau.');
  });
});
