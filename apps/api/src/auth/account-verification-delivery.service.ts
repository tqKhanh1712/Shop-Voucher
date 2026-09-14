import { Injectable, Logger } from '@nestjs/common';

export interface AccountVerificationDelivery {
  identifier: string;
  code: string;
  expiresAt: Date;
}

@Injectable()
export class AccountVerificationDeliveryService {
  private readonly logger = new Logger(AccountVerificationDeliveryService.name);
  private readonly mode: 'DISABLED' | 'CONSOLE';

  constructor() {
    const configured = (process.env.AUTH_VERIFICATION_DELIVERY ?? 'DISABLED')
      .trim()
      .toUpperCase();
    if (configured !== 'DISABLED' && configured !== 'CONSOLE') {
      throw new Error(
        'AUTH_VERIFICATION_DELIVERY must be DISABLED or CONSOLE.',
      );
    }
    const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
    if (configured === 'CONSOLE' && appEnv !== 'development') {
      throw new Error(
        'AUTH_VERIFICATION_DELIVERY=CONSOLE is only allowed in development.',
      );
    }
    this.mode = configured;
  }

  deliver(delivery: AccountVerificationDelivery): void {
    if (this.mode !== 'CONSOLE') {
      return;
    }
    this.logger.warn(
      `Development-only account verification code for ${delivery.identifier}: ${delivery.code} (expires ${delivery.expiresAt.toISOString()})`,
    );
  }
}
