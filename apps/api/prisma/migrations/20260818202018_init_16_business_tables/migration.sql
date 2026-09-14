-- Lean baseline for a brand-new Supabase/PostgreSQL database.
-- Creates application-owned objects only; Supabase-managed schemas are untouched.
BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'PARTNER', 'PARTNER_STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "PartnerApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PartnerAccountStatus" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAUSED', 'EXPIRED', 'SOLD_OUT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PROCESSING', 'PAID', 'FAILED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProviderType" AS ENUM ('STRIPE', 'PAYPAL', 'VNPAY');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentWebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentRefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'COMMITTED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VoucherCodeStatus" AS ENUM ('AVAILABLE', 'USED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Users" (
    "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255),
    "role" "UserRole" NOT NULL,
    "partner_id" UUID,
    "branch_id" UUID,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "refresh_token_hash" CHAR(64),
    "refresh_token_expires_at" TIMESTAMPTZ,
    "password_reset_token_hash" CHAR(64),
    "password_reset_expires_at" TIMESTAMPTZ,
    "password_changed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "Partners" (
    "partner_id" UUID NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "tax_code" VARCHAR(50) NOT NULL,
    "representative" VARCHAR(255),
    "approval_status" "PartnerApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "account_status" "PartnerAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partners_pkey" PRIMARY KEY ("partner_id")
);

-- CreateTable
CREATE TABLE "Branches" (
    "branch_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,

    CONSTRAINT "Branches_pkey" PRIMARY KEY ("branch_id")
);

-- CreateTable
CREATE TABLE "Voucher_Campaigns" (
    "campaign_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "original_price" DECIMAL(12,2) NOT NULL,
    "sale_price" DECIMAL(12,2) NOT NULL,
    "sale_start_time" TIMESTAMPTZ NOT NULL,
    "sale_end_time" TIMESTAMPTZ NOT NULL,
    "usage_start_time" TIMESTAMPTZ NOT NULL,
    "usage_end_time" TIMESTAMPTZ NOT NULL,
    "capacity" INTEGER NOT NULL,
    "sold_quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_stock" INTEGER NOT NULL DEFAULT 0,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "is_multi_use" BOOLEAN NOT NULL DEFAULT false,
    "max_uses_per_code" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voucher_Campaigns_pkey" PRIMARY KEY ("campaign_id")
);

-- CreateTable
CREATE TABLE "Campaign_Branches" (
    "partner_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,

    CONSTRAINT "Campaign_Branches_pkey" PRIMARY KEY ("campaign_id","branch_id")
);

-- CreateTable
CREATE TABLE "Orders" (
    "order_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_code" VARCHAR(32) NOT NULL,
    "customer_id" UUID NOT NULL,
    "recipient_note" TEXT,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "base_currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "selected_payment_provider" "PaymentProviderType",
    "order_status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "reservation_expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Orders_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "Order_Items" (
    "item_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "Order_Items_pkey" PRIMARY KEY ("item_id")
);

-- CreateTable
CREATE TABLE "Inventory_Reservations" (
    "reservation_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inventory_Reservations_pkey" PRIMARY KEY ("reservation_id")
);

-- CreateTable
CREATE TABLE "Payment_Transactions" (
    "payment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "provider" "PaymentProviderType" NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "provider_order_id" VARCHAR(255),
    "provider_transaction_id" VARCHAR(255),
    "base_amount" DECIMAL(12,2) NOT NULL,
    "request_amount_minor" BIGINT NOT NULL,
    "request_currency" CHAR(3) NOT NULL,
    "exchange_rate" DECIMAL(18,8),
    "failure_code" VARCHAR(100),
    "failure_message" TEXT,
    "expires_at" TIMESTAMPTZ,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_Transactions_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "Payment_Webhook_Events" (
    "webhook_event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" "PaymentProviderType" NOT NULL,
    "provider_event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "processing_status" "PaymentWebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "payment_id" UUID,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "Payment_Webhook_Events_pkey" PRIMARY KEY ("webhook_event_id")
);

-- CreateTable
CREATE TABLE "Payment_Refunds" (
    "refund_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "provider_refund_id" VARCHAR(255),
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentRefundStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_Refunds_pkey" PRIMARY KEY ("refund_id")
);

-- CreateTable
CREATE TABLE "Voucher_Codes" (
    "code_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "unique_code" VARCHAR(64) NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "VoucherCodeStatus" NOT NULL DEFAULT 'AVAILABLE',
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voucher_Codes_pkey" PRIMARY KEY ("code_id")
);

-- CreateTable
CREATE TABLE "Voucher_Usage_Log" (
    "usage_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voucher_Usage_Log_pkey" PRIMARY KEY ("usage_id")
);

-- CreateTable
CREATE TABLE "Audit_Logs" (
    "log_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "admin_name_snapshot" TEXT NOT NULL,
    "admin_email_snapshot" TEXT,
    "action_type" VARCHAR(100) NOT NULL,
    "target_entity" VARCHAR(100) NOT NULL,
    "target_id" UUID,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Audit_Logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "Cart_Items" (
    "cart_item_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cart_Items_pkey" PRIMARY KEY ("cart_item_id")
);

-- CreateTable
CREATE TABLE "Voucher_Reviews" (
    "review_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voucher_Reviews_pkey" PRIMARY KEY ("review_id")
);

-- Lean set of database invariants. Keep only rules that protect authorization
-- scope, money, inventory, idempotency inputs, and core business validity.
ALTER TABLE "Users"
    ADD CONSTRAINT "Users_login_identifier_check"
        CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL),
    ADD CONSTRAINT "Users_partner_staff_scope_check"
        CHECK (
            ("role" = 'PARTNER_STAFF' AND "partner_id" IS NOT NULL AND "branch_id" IS NOT NULL)
            OR
            ("role" <> 'PARTNER_STAFF' AND "partner_id" IS NULL AND "branch_id" IS NULL)
        );

ALTER TABLE "Voucher_Campaigns"
    ADD CONSTRAINT "Voucher_Campaigns_price_check"
        CHECK ("original_price" > 0 AND "sale_price" >= 0 AND "sale_price" < "original_price"),
    ADD CONSTRAINT "Voucher_Campaigns_sale_window_check"
        CHECK ("sale_start_time" < "sale_end_time"),
    ADD CONSTRAINT "Voucher_Campaigns_usage_window_check"
        CHECK ("usage_start_time" < "usage_end_time" AND "sale_end_time" <= "usage_end_time"),
    ADD CONSTRAINT "Voucher_Campaigns_inventory_bounds_check"
        CHECK (
            "capacity" > 0
            AND "sold_quantity" >= 0
            AND "reserved_stock" >= 0
            AND "sold_quantity" + "reserved_stock" <= "capacity"
        ),
    ADD CONSTRAINT "Voucher_Campaigns_multi_use_check"
        CHECK (
            ("is_multi_use" AND "max_uses_per_code" >= 2)
            OR
            (NOT "is_multi_use" AND "max_uses_per_code" IS NULL)
        );

ALTER TABLE "Orders"
    ADD CONSTRAINT "Orders_total_amount_check"
        CHECK ("total_amount" >= 0),
    ADD CONSTRAINT "Orders_base_currency_check"
        CHECK (btrim("base_currency") ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "Orders_reservation_window_check"
        CHECK ("reservation_expires_at" > "created_at");

ALTER TABLE "Order_Items"
    ADD CONSTRAINT "Order_Items_quantity_check"
        CHECK ("quantity" > 0),
    ADD CONSTRAINT "Order_Items_unit_price_check"
        CHECK ("unit_price" >= 0);

ALTER TABLE "Inventory_Reservations"
    ADD CONSTRAINT "Inventory_Reservations_quantity_check"
        CHECK ("quantity" > 0),
    ADD CONSTRAINT "Inventory_Reservations_expiry_window_check"
        CHECK ("expires_at" > "created_at");

ALTER TABLE "Payment_Transactions"
    ADD CONSTRAINT "Payment_Transactions_attempt_no_check"
        CHECK ("attempt_no" > 0),
    ADD CONSTRAINT "Payment_Transactions_amount_check"
        CHECK ("base_amount" > 0 AND "request_amount_minor" > 0),
    ADD CONSTRAINT "Payment_Transactions_currency_check"
        CHECK (btrim("request_currency") ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "Payment_Transactions_exchange_rate_check"
        CHECK ("exchange_rate" IS NULL OR "exchange_rate" > 0),
    ADD CONSTRAINT "Payment_Transactions_success_metadata_check"
        CHECK (
            "status" NOT IN ('SUCCEEDED', 'REFUND_PENDING', 'REFUNDED')
            OR (
                "paid_at" IS NOT NULL
                AND "paid_at" >= "created_at"
                AND "provider_transaction_id" IS NOT NULL
            )
        );

ALTER TABLE "Payment_Webhook_Events"
    ADD CONSTRAINT "Payment_Webhook_Events_provider_event_id_check"
        CHECK (btrim("provider_event_id") <> ''),
    ADD CONSTRAINT "Payment_Webhook_Events_event_type_check"
        CHECK (btrim("event_type") <> ''),
    ADD CONSTRAINT "Payment_Webhook_Events_payload_hash_check"
        CHECK (btrim("payload_hash") ~ '^[0-9A-Fa-f]{64}$');

ALTER TABLE "Payment_Refunds"
    ADD CONSTRAINT "Payment_Refunds_amount_check"
        CHECK ("amount_minor" > 0),
    ADD CONSTRAINT "Payment_Refunds_currency_check"
        CHECK (btrim("currency") ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "Payment_Refunds_reason_check"
        CHECK (btrim("reason") <> '');

ALTER TABLE "Audit_Logs"
    ADD CONSTRAINT "Audit_Logs_admin_name_check"
        CHECK (btrim("admin_name_snapshot") <> ''),
    ADD CONSTRAINT "Audit_Logs_action_type_check"
        CHECK (btrim("action_type") <> ''),
    ADD CONSTRAINT "Audit_Logs_target_entity_check"
        CHECK (btrim("target_entity") <> '');

ALTER TABLE "Cart_Items"
    ADD CONSTRAINT "Cart_Items_quantity_check"
        CHECK ("quantity" > 0);

ALTER TABLE "Voucher_Reviews"
    ADD CONSTRAINT "Voucher_Reviews_rating_check"
        CHECK ("rating" BETWEEN 1 AND 5);

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Users_phone_key" ON "Users"("phone");

-- CreateIndex
CREATE INDEX "Users_partner_branch_idx" ON "Users"("partner_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "Partners_tax_code_key" ON "Partners"("tax_code");

-- CreateIndex
CREATE UNIQUE INDEX "Branches_partner_id_branch_id_key" ON "Branches"("partner_id", "branch_id");

-- CreateIndex
CREATE INDEX "Voucher_Campaigns_partner_created_at_idx" ON "Voucher_Campaigns"("partner_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_Campaigns_partner_id_campaign_id_key" ON "Voucher_Campaigns"("partner_id", "campaign_id");

-- CreateIndex
CREATE INDEX "Campaign_Branches_partner_campaign_idx" ON "Campaign_Branches"("partner_id", "campaign_id");

-- CreateIndex
CREATE INDEX "Campaign_Branches_partner_branch_idx" ON "Campaign_Branches"("partner_id", "branch_id");

-- CreateIndex
CREATE INDEX "Campaign_Branches_branch_campaign_idx" ON "Campaign_Branches"("branch_id", "campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "Orders_order_code_key" ON "Orders"("order_code");

-- CreateIndex
CREATE INDEX "Orders_customer_created_at_idx" ON "Orders"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Orders_created_at_idx" ON "Orders"("created_at" DESC);

-- CreateIndex
CREATE INDEX "Order_Items_campaign_id_idx" ON "Order_Items"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_Items_order_id_campaign_id_key" ON "Order_Items"("order_id", "campaign_id");

-- CreateIndex
CREATE INDEX "Inventory_Reservations_campaign_id_idx" ON "Inventory_Reservations"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_Reservations_order_id_campaign_id_key" ON "Inventory_Reservations"("order_id", "campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_Transactions_idempotency_key_key" ON "Payment_Transactions"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_Transactions_order_id_attempt_no_key" ON "Payment_Transactions"("order_id", "attempt_no");

-- CreateIndex
CREATE INDEX "Payment_Webhook_Events_payment_id_idx" ON "Payment_Webhook_Events"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_Webhook_Events_provider_provider_event_id_key" ON "Payment_Webhook_Events"("provider", "provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_Refunds_idempotency_key_key" ON "Payment_Refunds"("idempotency_key");

-- CreateIndex
CREATE INDEX "Payment_Refunds_payment_id_idx" ON "Payment_Refunds"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_Codes_unique_code_key" ON "Voucher_Codes"("unique_code");

-- CreateIndex
CREATE INDEX "Voucher_Codes_customer_issued_at_idx" ON "Voucher_Codes"("customer_id", "issued_at" DESC);

-- CreateIndex
CREATE INDEX "Voucher_Codes_item_id_idx" ON "Voucher_Codes"("item_id");

-- CreateIndex
CREATE INDEX "Voucher_Usage_Log_code_used_at_idx" ON "Voucher_Usage_Log"("code_id", "used_at" DESC);

-- CreateIndex
CREATE INDEX "Voucher_Usage_Log_branch_used_at_idx" ON "Voucher_Usage_Log"("branch_id", "used_at" DESC);

-- CreateIndex
CREATE INDEX "Audit_Logs_admin_id_idx" ON "Audit_Logs"("admin_id");

-- CreateIndex
CREATE INDEX "Audit_Logs_timestamp_idx" ON "Audit_Logs"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "Cart_Items_campaign_id_idx" ON "Cart_Items"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_Items_customer_id_campaign_id_key" ON "Cart_Items"("customer_id", "campaign_id");

-- CreateIndex
CREATE INDEX "Voucher_Reviews_campaign_created_at_idx" ON "Voucher_Reviews"("campaign_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_Reviews_customer_id_campaign_id_key" ON "Voucher_Reviews"("customer_id", "campaign_id");

-- Partial indexes keep nullable provider references and filtered hot paths small.
CREATE UNIQUE INDEX "Payment_Transactions_provider_order_id_key"
    ON "Payment_Transactions"("provider", "provider_order_id")
    WHERE "provider_order_id" IS NOT NULL;

CREATE UNIQUE INDEX "Payment_Transactions_provider_transaction_id_key"
    ON "Payment_Transactions"("provider", "provider_transaction_id")
    WHERE "provider_transaction_id" IS NOT NULL;

CREATE UNIQUE INDEX "Payment_Transactions_one_succeeded_order_idx"
    ON "Payment_Transactions"("order_id")
    WHERE "status" = 'SUCCEEDED';

CREATE INDEX "Inventory_Reservations_active_expires_at_idx"
    ON "Inventory_Reservations"("expires_at")
    WHERE "status" = 'ACTIVE';

CREATE INDEX "Voucher_Campaigns_active_sale_window_idx"
    ON "Voucher_Campaigns"("sale_end_time", "sale_start_time", "created_at" DESC)
    WHERE "status" = 'APPROVED';

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "Users_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "Partners"("partner_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "Users_partner_id_branch_id_fkey" FOREIGN KEY ("partner_id", "branch_id") REFERENCES "Branches"("partner_id", "branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partners" ADD CONSTRAINT "Partners_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branches" ADD CONSTRAINT "Branches_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "Partners"("partner_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher_Campaigns" ADD CONSTRAINT "Voucher_Campaigns_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "Partners"("partner_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign_Branches" ADD CONSTRAINT "Campaign_Branches_partner_id_campaign_id_fkey" FOREIGN KEY ("partner_id", "campaign_id") REFERENCES "Voucher_Campaigns"("partner_id", "campaign_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign_Branches" ADD CONSTRAINT "Campaign_Branches_partner_id_branch_id_fkey" FOREIGN KEY ("partner_id", "branch_id") REFERENCES "Branches"("partner_id", "branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Orders" ADD CONSTRAINT "Orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order_Items" ADD CONSTRAINT "Order_Items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Orders"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order_Items" ADD CONSTRAINT "Order_Items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Voucher_Campaigns"("campaign_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory_Reservations" ADD CONSTRAINT "Inventory_Reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Orders"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory_Reservations" ADD CONSTRAINT "Inventory_Reservations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Voucher_Campaigns"("campaign_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment_Transactions" ADD CONSTRAINT "Payment_Transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Orders"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment_Webhook_Events" ADD CONSTRAINT "Payment_Webhook_Events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "Payment_Transactions"("payment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment_Refunds" ADD CONSTRAINT "Payment_Refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "Payment_Transactions"("payment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher_Codes" ADD CONSTRAINT "Voucher_Codes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Order_Items"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher_Codes" ADD CONSTRAINT "Voucher_Codes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher_Usage_Log" ADD CONSTRAINT "Voucher_Usage_Log_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "Voucher_Codes"("code_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher_Usage_Log" ADD CONSTRAINT "Voucher_Usage_Log_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branches"("branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit_Logs" ADD CONSTRAINT "Audit_Logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "Users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart_Items" ADD CONSTRAINT "Cart_Items_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart_Items" ADD CONSTRAINT "Cart_Items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Voucher_Campaigns"("campaign_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher_Reviews" ADD CONSTRAINT "Voucher_Reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher_Reviews" ADD CONSTRAINT "Voucher_Reviews_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Voucher_Campaigns"("campaign_id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
