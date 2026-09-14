-- Preserve historical payment records while changing the provider label used by Prisma.
ALTER TYPE "PaymentProviderType" RENAME VALUE 'VNPAY' TO 'ZALOPAY';
