-- Add the fourth sandbox provider. No table grants are added: payment data remains
-- accessible only through the backend's direct Postgres connection.
ALTER TYPE "PaymentProviderType" ADD VALUE IF NOT EXISTS 'MOMO';

ALTER TABLE "Payment_Transactions"
    ADD COLUMN "settled_amount_minor" BIGINT,
    ADD COLUMN "settled_currency" CHAR(3);

ALTER TABLE "Payment_Webhook_Events"
    ADD COLUMN "processing_error" TEXT;

-- Existing code did not persist provider order IDs or settlement amounts. Backfill
-- historical terminal rows before strengthening the metadata constraint.
UPDATE "Payment_Transactions"
SET
    "provider_order_id" = COALESCE("provider_order_id", "payment_id"::text),
    "provider_transaction_id" = COALESCE(
        "provider_transaction_id",
        'LEGACY-' || "payment_id"::text
    ),
    "settled_amount_minor" = COALESCE("settled_amount_minor", "request_amount_minor"),
    "settled_currency" = COALESCE("settled_currency", "request_currency"),
    "paid_at" = GREATEST(COALESCE("paid_at", "created_at"), "created_at")
WHERE "status" IN ('SUCCEEDED', 'REFUND_PENDING', 'REFUNDED');

-- Old PENDING attempts have no trustworthy provider binding. Close them rather
-- than allowing an unverifiable legacy callback to complete after this migration.
UPDATE "Payment_Transactions"
SET
    "status" = 'CANCELLED',
    "failure_code" = COALESCE("failure_code", 'P0_MIGRATION_UNBOUND_ATTEMPT'),
    "failure_message" = COALESCE(
        "failure_message",
        'Attempt closed because it predates provider-order binding.'
    )
WHERE "status" = 'PENDING'
  AND "provider_order_id" IS NULL;

-- Keep only the newest open attempt per order before adding the partial unique
-- index. New application code also cancels older attempts while holding the order
-- row lock.
WITH ranked_open_attempts AS (
    SELECT
        "payment_id",
        row_number() OVER (
            PARTITION BY "order_id"
            ORDER BY "attempt_no" DESC, "created_at" DESC, "payment_id" DESC
        ) AS open_rank
    FROM "Payment_Transactions"
    WHERE "status" IN ('CREATED', 'PENDING')
)
UPDATE "Payment_Transactions" AS payment
SET
    "status" = 'CANCELLED',
    "failure_code" = COALESCE("failure_code", 'P0_MIGRATION_SUPERSEDED_ATTEMPT'),
    "failure_message" = COALESCE(
        "failure_message",
        'Attempt superseded while enforcing one active attempt per order.'
    )
FROM ranked_open_attempts AS ranked
WHERE payment."payment_id" = ranked."payment_id"
  AND ranked.open_rank > 1;

DROP INDEX IF EXISTS "Payment_Transactions_one_active_order_idx";
CREATE UNIQUE INDEX "Payment_Transactions_one_active_order_idx"
    ON "Payment_Transactions"("order_id")
    WHERE "status" IN ('CREATED', 'PENDING');

ALTER TABLE "Payment_Transactions"
    DROP CONSTRAINT IF EXISTS "Payment_Transactions_success_metadata_check";

ALTER TABLE "Payment_Transactions"
    ADD CONSTRAINT "Payment_Transactions_provider_order_required_check"
        CHECK (
            "status" NOT IN ('PENDING', 'SUCCEEDED', 'REFUND_PENDING', 'REFUNDED')
            OR "provider_order_id" IS NOT NULL
        ),
    ADD CONSTRAINT "Payment_Transactions_settlement_metadata_check"
        CHECK (
            "status" NOT IN ('SUCCEEDED', 'REFUND_PENDING', 'REFUNDED')
            OR (
                "paid_at" IS NOT NULL
                AND "paid_at" >= "created_at"
                AND "provider_transaction_id" IS NOT NULL
                AND "settled_amount_minor" IS NOT NULL
                AND "settled_amount_minor" > 0
                AND "settled_currency" IS NOT NULL
                AND btrim("settled_currency") ~ '^[A-Z]{3}$'
            )
        );
