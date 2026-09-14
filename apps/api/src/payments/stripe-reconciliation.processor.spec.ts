import { StripeReconciliationProcessor } from './stripe-reconciliation.processor';

describe('StripeReconciliationProcessor', () => {
  it('does not call Stripe or the database in SIMULATED mode', async () => {
    const prisma = {
      paymentTransaction: { findMany: jest.fn() },
      paymentRefund: { findMany: jest.fn() },
    };
    const stripe = { queryEvidence: jest.fn(), expireSession: jest.fn() };
    const processor = new StripeReconciliationProcessor(
      prisma as any,
      { isSandbox: () => false } as any,
      stripe as any,
      { processEvidence: jest.fn(), retryPendingRefund: jest.fn() } as any,
    );

    await processor.reconcileExpiredSessions();

    expect(prisma.paymentTransaction.findMany).not.toHaveBeenCalled();
    expect(stripe.queryEvidence).not.toHaveBeenCalled();
  });
});
