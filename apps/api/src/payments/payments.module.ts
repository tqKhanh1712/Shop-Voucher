import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentFinalizationService } from './payment-finalization.service';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ZaloPayAdapter } from './adapters/zalopay.adapter';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PaypalAdapter } from './adapters/paypal.adapter';
import { MomoAdapter } from './adapters/momo.adapter';
import { StripeConfigService } from './stripe.config';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeReconciliationProcessor } from './stripe-reconciliation.processor';
import { EmailService } from './email.service';
import { ZaloPayConfigService } from './zalopay.config';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentFinalizationService,
    ZaloPayAdapter,
    ZaloPayConfigService,
    StripeConfigService,
    StripeAdapter,
    StripeWebhookService,
    StripeReconciliationProcessor,
    PaypalAdapter,
    MomoAdapter,
    EmailService,
  ],
  exports: [
    PaymentsService,
    PaymentFinalizationService,
    ZaloPayAdapter,
    ZaloPayConfigService,
    StripeConfigService,
    StripeAdapter,
    StripeWebhookService,
    PaypalAdapter,
    MomoAdapter,
    EmailService,
  ],
})
export class PaymentsModule {}
