-- Foundations for BRD sections 7-10: voucher expiry/locking, refund policy
-- snapshots, activity history, complaints, and administrable content.

BEGIN;

ALTER TYPE "public"."VoucherCodeStatus" ADD VALUE IF NOT EXISTS 'LOCKED';

CREATE TYPE "public"."ActivityCategory" AS ENUM (
  'AUTH',
  'ACCOUNT',
  'ADMIN',
  'TRANSACTION',
  'VOUCHER',
  'CONTENT',
  'SUPPORT',
  'SYSTEM'
);

CREATE TYPE "public"."ComplaintType" AS ENUM (
  'VOUCHER',
  'ORDER',
  'PAYMENT',
  'PARTNER',
  'OTHER'
);

CREATE TYPE "public"."ComplaintStatus" AS ENUM (
  'OPEN',
  'IN_REVIEW',
  'RESOLVED',
  'REJECTED',
  'CLOSED'
);

CREATE TYPE "public"."ContentType" AS ENUM (
  'BANNER',
  'ARTICLE',
  'POPUP',
  'POLICY'
);

CREATE TYPE "public"."ContentStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

ALTER TABLE "public"."Voucher_Campaigns"
  ADD COLUMN "refund_allowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "refund_window_hours" INTEGER,
  ADD COLUMN "refund_policy" TEXT,
  ADD COLUMN "cancellation_policy" TEXT,
  ADD COLUMN "policy_version" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "Voucher_Campaigns_refund_window_check"
    CHECK ("refund_window_hours" IS NULL OR "refund_window_hours" > 0),
  ADD CONSTRAINT "Voucher_Campaigns_policy_version_check"
    CHECK ("policy_version" > 0);

ALTER TABLE "public"."Order_Items"
  ADD COLUMN "refund_allowed_snapshot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "refund_window_hours_snapshot" INTEGER,
  ADD COLUMN "refund_policy_snapshot" TEXT,
  ADD COLUMN "cancellation_policy_snapshot" TEXT,
  ADD COLUMN "policy_version_snapshot" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "refund_deadline_at" TIMESTAMPTZ,
  ADD CONSTRAINT "Order_Items_refund_window_snapshot_check"
    CHECK (
      "refund_window_hours_snapshot" IS NULL
      OR "refund_window_hours_snapshot" > 0
    ),
  ADD CONSTRAINT "Order_Items_policy_version_snapshot_check"
    CHECK ("policy_version_snapshot" > 0);

CREATE INDEX "Order_Items_refund_deadline_active_idx"
  ON "public"."Order_Items"("refund_deadline_at")
  WHERE "refund_allowed_snapshot" = true
    AND "refund_deadline_at" IS NOT NULL;

ALTER TABLE "public"."Voucher_Codes"
  ADD COLUMN "expires_at" TIMESTAMPTZ,
  ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "public"."Voucher_Codes" AS voucher_code
SET "expires_at" = campaign."usage_end_time"
FROM "public"."Order_Items" AS order_item
JOIN "public"."Voucher_Campaigns" AS campaign
  ON campaign."campaign_id" = order_item."campaign_id"
WHERE voucher_code."item_id" = order_item."item_id";

ALTER TABLE "public"."Voucher_Codes"
  ALTER COLUMN "expires_at" SET NOT NULL,
  ADD CONSTRAINT "Voucher_Codes_expiry_check"
    CHECK ("expires_at" >= "issued_at");

CREATE INDEX "Voucher_Codes_status_expires_at_idx"
  ON "public"."Voucher_Codes"("status", "expires_at");

CREATE TABLE "public"."Activity_Logs" (
  "activity_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID,
  "actor_role_snapshot" "public"."UserRole",
  "category" "public"."ActivityCategory" NOT NULL,
  "action_type" VARCHAR(100) NOT NULL,
  "target_entity" VARCHAR(100) NOT NULL,
  "target_id" VARCHAR(100),
  "metadata" JSONB,
  "ip_address" VARCHAR(64),
  "user_agent" VARCHAR(512),
  "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Activity_Logs_pkey" PRIMARY KEY ("activity_id"),
  CONSTRAINT "Activity_Logs_action_type_check"
    CHECK (btrim("action_type") <> ''),
  CONSTRAINT "Activity_Logs_target_entity_check"
    CHECK (btrim("target_entity") <> ''),
  CONSTRAINT "Activity_Logs_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "public"."Users"("user_id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Activity_Logs_actor_occurred_at_idx"
  ON "public"."Activity_Logs"("actor_user_id", "occurred_at" DESC);
CREATE INDEX "Activity_Logs_category_occurred_at_idx"
  ON "public"."Activity_Logs"("category", "occurred_at" DESC);
CREATE INDEX "Activity_Logs_target_occurred_at_idx"
  ON "public"."Activity_Logs"("target_entity", "target_id", "occurred_at" DESC);

INSERT INTO "public"."Activity_Logs" (
  "actor_user_id",
  "actor_role_snapshot",
  "category",
  "action_type",
  "target_entity",
  "target_id",
  "metadata",
  "occurred_at"
)
SELECT
  audit."admin_id",
  'ADMIN'::"public"."UserRole",
  'ADMIN'::"public"."ActivityCategory",
  audit."action_type",
  audit."target_entity",
  audit."target_id"::text,
  jsonb_build_object(
    'legacyAuditLogId', audit."log_id",
    'adminNameSnapshot', audit."admin_name_snapshot",
    'adminEmailSnapshot', audit."admin_email_snapshot"
  ),
  audit."timestamp"
FROM "public"."Audit_Logs" AS audit;

CREATE TABLE "public"."Content_Entries" (
  "content_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "public"."ContentType" NOT NULL,
  "slug" VARCHAR(150) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "summary" TEXT,
  "body" TEXT,
  "image_url" TEXT,
  "link_url" TEXT,
  "status" "public"."ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "published_at" TIMESTAMPTZ,
  "starts_at" TIMESTAMPTZ,
  "ends_at" TIMESTAMPTZ,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Content_Entries_pkey" PRIMARY KEY ("content_id"),
  CONSTRAINT "Content_Entries_slug_key" UNIQUE ("slug"),
  CONSTRAINT "Content_Entries_slug_check" CHECK (btrim("slug") <> ''),
  CONSTRAINT "Content_Entries_title_check" CHECK (btrim("title") <> ''),
  CONSTRAINT "Content_Entries_display_order_check" CHECK ("display_order" >= 0),
  CONSTRAINT "Content_Entries_window_check"
    CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "starts_at" < "ends_at"),
  CONSTRAINT "Content_Entries_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "public"."Users"("user_id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Content_Entries_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "public"."Users"("user_id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Content_Entries_type_status_order_idx"
  ON "public"."Content_Entries"("type", "status", "display_order");
CREATE INDEX "Content_Entries_status_window_idx"
  ON "public"."Content_Entries"("status", "starts_at", "ends_at");

CREATE TABLE "public"."Complaints" (
  "complaint_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "order_id" UUID,
  "campaign_id" UUID,
  "review_id" UUID,
  "type" "public"."ComplaintType" NOT NULL,
  "subject" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "status" "public"."ComplaintStatus" NOT NULL DEFAULT 'OPEN',
  "resolution_response" TEXT,
  "resolved_by_id" UUID,
  "resolved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Complaints_pkey" PRIMARY KEY ("complaint_id"),
  CONSTRAINT "Complaints_subject_check" CHECK (btrim("subject") <> ''),
  CONSTRAINT "Complaints_description_check" CHECK (btrim("description") <> ''),
  CONSTRAINT "Complaints_resolution_state_check"
    CHECK (
      ("status" IN ('OPEN', 'IN_REVIEW') AND "resolved_at" IS NULL)
      OR
      ("status" IN ('RESOLVED', 'REJECTED', 'CLOSED') AND "resolved_at" IS NOT NULL)
    ),
  CONSTRAINT "Complaints_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "public"."Users"("user_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Complaints_resolved_by_id_fkey"
    FOREIGN KEY ("resolved_by_id") REFERENCES "public"."Users"("user_id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Complaints_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "public"."Orders"("order_id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Complaints_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "public"."Voucher_Campaigns"("campaign_id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Complaints_review_id_fkey"
    FOREIGN KEY ("review_id") REFERENCES "public"."Voucher_Reviews"("review_id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Complaints_customer_created_at_idx"
  ON "public"."Complaints"("customer_id", "created_at" DESC);
CREATE INDEX "Complaints_status_created_at_idx"
  ON "public"."Complaints"("status", "created_at" DESC);
CREATE INDEX "Complaints_order_id_idx"
  ON "public"."Complaints"("order_id");
CREATE INDEX "Complaints_campaign_id_idx"
  ON "public"."Complaints"("campaign_id");

REVOKE ALL PRIVILEGES ON TABLE
  "public"."Activity_Logs",
  "public"."Content_Entries",
  "public"."Complaints"
FROM anon, authenticated;

ALTER TABLE "public"."Activity_Logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Content_Entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Complaints" ENABLE ROW LEVEL SECURITY;

COMMIT;
