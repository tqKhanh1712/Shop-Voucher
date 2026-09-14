import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('EmailService', () => {
  let emailService: EmailService;
  let mockSendMail: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-msg-id' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
    });

    process.env.GMAIL_USER = 'test@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'password123';
    emailService = new EmailService();
  });

  afterEach(() => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
  });

  it('should be defined', () => {
    expect(emailService).toBeDefined();
  });

  it('should send gift email successfully with correct options', async () => {
    const result = await emailService.sendGiftEmail(
      'recipient@gmail.com',
      'Tuan Nguyen',
      'Chúc mừng sinh nhật!',
      'ORD-123456',
      [{ title: 'Voucher Highlands Coffee 50k', code: 'HL50K-ABC' }],
    );

    expect(result).toBe(true);
    expect(mockSendMail).toHaveBeenCalled();

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.to).toBe('recipient@gmail.com');
    expect(callArgs.subject).toContain('Tuan Nguyen');
    expect(callArgs.html).toContain('HL50K-ABC');
    expect(callArgs.html).toContain('Chúc mừng sinh nhật!');
  });

  it('should return false and not send mail when credentials are missing', async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;

    const noCredsService = new EmailService();
    const result = await noCredsService.sendGiftEmail(
      'recipient@gmail.com',
      'Tuan Nguyen',
      'Lời chúc',
      'ORD-123456',
      [{ title: 'Voucher', code: 'CODE' }],
    );

    expect(result).toBe(false);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('should return false when nodemailer sendMail throws an error', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP Error'));

    const result = await emailService.sendGiftEmail(
      'recipient@gmail.com',
      'Tuan Nguyen',
      'Lời chúc',
      'ORD-123456',
      [{ title: 'Voucher', code: 'CODE' }],
    );

    expect(result).toBe(false);
  });
});
