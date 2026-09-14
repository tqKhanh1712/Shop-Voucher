import { Injectable } from '@nestjs/common';

@Injectable()
export class ZaloPayConfigService {
  readonly apiUrl =
    process.env.ZALOPAY_API_URL?.trim() ||
    'https://sb-openapi.zalopay.vn/v2/create';

  get appId(): number {
    const value = this.required('ZALOPAY_APP_ID');
    if (!/^\d+$/.test(value) || Number(value) <= 0) {
      throw new Error('ZALOPAY_APP_ID must be a positive integer.');
    }
    return Number(value);
  }

  get key1(): string {
    return this.required('ZALOPAY_KEY1');
  }

  get key2(): string {
    return this.required('ZALOPAY_KEY2');
  }

  get callbackUrl(): string {
    return this.requiredUrl('ZALOPAY_CALLBACK_URL');
  }

  get redirectUrl(): string {
    return this.requiredUrl('ZALOPAY_REDIRECT_URL');
  }

  assertConfigured(): void {
    void this.appId;
    void this.key1;
    void this.key2;
    const callbackUrl = new URL(this.callbackUrl);
    void this.redirectUrl;

    if (callbackUrl.protocol !== 'https:') {
      throw new Error('ZALOPAY_CALLBACK_URL must use public HTTPS.');
    }

    let apiUrl: URL;
    try {
      apiUrl = new URL(this.apiUrl);
    } catch {
      throw new Error('ZALOPAY_API_URL must be a valid URL.');
    }
    if (
      apiUrl.protocol !== 'https:' ||
      apiUrl.hostname !== 'sb-openapi.zalopay.vn' ||
      apiUrl.pathname !== '/v2/create'
    ) {
      throw new Error(
        'ZALOPAY_API_URL must point to the ZaloPay Sandbox Create Order endpoint.',
      );
    }
  }

  private required(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new Error(`${name} is required when using ZALOPAY.`);
    }
    return value;
  }

  private requiredUrl(name: string): string {
    const value = this.required(name);
    try {
      return new URL(value).toString();
    } catch {
      throw new Error(`${name} must be a valid absolute URL.`);
    }
  }
}
