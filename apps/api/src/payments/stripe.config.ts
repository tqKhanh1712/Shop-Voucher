import { Injectable } from '@nestjs/common';

export type StripePaymentMode = 'SIMULATED' | 'SANDBOX';

@Injectable()
export class StripeConfigService {
  readonly mode: StripePaymentMode;
  readonly frontendUrl: string;

  constructor() {
    const appEnv = (
      process.env.APP_ENV ??
      process.env.NODE_ENV ??
      'development'
    )
      .trim()
      .toLowerCase();
    const configuredMode = process.env.PAYMENT_MODE?.trim().toUpperCase();

    if (!configuredMode && appEnv === 'production') {
      throw new Error(
        'PAYMENT_MODE must be explicitly set to SIMULATED or SANDBOX in production.',
      );
    }

    const mode = configuredMode || 'SIMULATED';
    if (mode !== 'SIMULATED' && mode !== 'SANDBOX') {
      throw new Error(
        'PAYMENT_MODE must be SIMULATED or SANDBOX. Live Stripe payments are not supported.',
      );
    }

    this.mode = mode;
    this.frontendUrl = this.readFrontendUrl();

    if (this.isSandbox()) {
      void this.secretKey;
      void this.webhookSecret;
    }
  }

  isSimulated(): boolean {
    return this.mode === 'SIMULATED';
  }

  isSandbox(): boolean {
    return this.mode === 'SANDBOX';
  }

  get secretKey(): string {
    const value = this.readRequiredSandboxValue('STRIPE_SECRET_KEY');
    if (value && !value.startsWith('sk_test_')) {
      throw new Error(
        'STRIPE_SECRET_KEY must be a Stripe test key (sk_test_...). Live keys are not supported.',
      );
    }
    return value;
  }

  get webhookSecret(): string {
    const value = this.readRequiredSandboxValue('STRIPE_WEBHOOK_SECRET');
    if (value && !value.startsWith('whsec_')) {
      throw new Error('STRIPE_WEBHOOK_SECRET must start with whsec_.');
    }
    return value;
  }

  private readRequiredSandboxValue(name: string): string {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
    if (this.isSimulated()) {
      return '';
    }
    throw new Error(`${name} is required when PAYMENT_MODE=SANDBOX.`);
  }

  private readFrontendUrl(): string {
    const raw =
      process.env.FRONTEND_URL?.trim() ||
      (this.isSimulated() ? 'http://localhost:3000' : '');
    if (!raw) {
      throw new Error('FRONTEND_URL is required when PAYMENT_MODE=SANDBOX.');
    }

    const url = new URL(raw);
    const isLocal =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (this.isSandbox() && url.protocol !== 'https:' && !isLocal) {
      throw new Error(
        'FRONTEND_URL must use HTTPS in SANDBOX mode, except for localhost.',
      );
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('FRONTEND_URL must be an HTTP(S) URL.');
    }

    return url.toString().replace(/\/$/, '');
  }
}
