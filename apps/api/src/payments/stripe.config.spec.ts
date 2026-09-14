import { StripeConfigService } from './stripe.config';

describe('StripeConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, APP_ENV: 'test' };
    delete process.env.PAYMENT_MODE;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.FRONTEND_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults tests to a network-free simulation', () => {
    const config = new StripeConfigService();

    expect(config.mode).toBe('SIMULATED');
    expect(config.frontendUrl).toBe('http://localhost:3000');
    expect(config.secretKey).toBe('');
  });

  it('requires Stripe test credentials in sandbox mode', () => {
    process.env.PAYMENT_MODE = 'SANDBOX';
    process.env.FRONTEND_URL = 'http://localhost:3000';

    expect(() => new StripeConfigService()).toThrow('STRIPE_SECRET_KEY');
  });

  it('rejects a live Stripe secret key', () => {
    Object.assign(process.env, {
      PAYMENT_MODE: 'SANDBOX',
      FRONTEND_URL: 'https://frontend.example.test',
      STRIPE_SECRET_KEY: 'sk_live_forbidden',
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
    });

    expect(() => new StripeConfigService()).toThrow('sk_test_');
  });

  it('rejects an insecure remote frontend in sandbox mode', () => {
    Object.assign(process.env, {
      PAYMENT_MODE: 'SANDBOX',
      FRONTEND_URL: 'http://frontend.example.test',
      STRIPE_SECRET_KEY: 'sk_test_placeholder',
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
    });

    expect(() => new StripeConfigService()).toThrow('must use HTTPS');
  });
});
