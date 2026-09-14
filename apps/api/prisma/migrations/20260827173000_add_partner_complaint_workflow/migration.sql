ALTER TYPE "public"."ComplaintStatus"
  ADD VALUE IF NOT EXISTS 'WAITING_PARTNER';
ALTER TYPE "public"."ComplaintStatus"
  ADD VALUE IF NOT EXISTS 'WAITING_CUSTOMER';

BEGIN;

CREATE TYPE "public"."ComplaintPriority" AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

CREATE TYPE "public"."ComplaintMessageVisibility" AS ENUM (
  'ALL_PARTIES',
  'ADMIN_ONLY'
);

ALTER TABLE "public"."Complaints"
  ADD COLUMN "partner_id" UUID,
  ADD COLUMN "assigned_admin_id" UUID,
  ADD COLUMN "order_item_id" UUID,
  ADD COLUMN "voucher_code_id" UUID,
  ADD COLUMN "priority" "public"."ComplaintPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "partner_due_at" TIMESTAMPTZ,
  ADD COLUMN "customer_due_at" TIMESTAMPTZ,
  ADD COLUMN "closed_at" TIMESTAMPTZ,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "public"."Complaints" AS complaint
SET "partner_id" = campaign."partner_id"
FROM "public"."Voucher_Campaigns" AS campaign
WHERE complaint."campaign_id" = campaign."campaign_id";

UPDATE "public"."Complaints" AS complaint
SET "partner_id" = campaign."partner_id"
FROM "public"."Voucher_Reviews" AS review
JOIN "public"."Voucher_Campaigns" AS campaign
  ON campaign."campaign_id" = review."campaign_id"
WHERE complaint."partner_id" IS NULL
  AND complaint."review_id" = review."review_id";

WITH single_partner_orders AS (
  SELECT
    order_item."order_id",
    min(campaign."partner_id"::text)::uuid AS partner_id
  FROM "public"."Order_Items" AS order_item
  JOIN "public"."Voucher_Campaigns" AS campaign
    ON campaign."campaign_id" = order_item."campaign_id"
  GROUP BY order_item."order_id"
  HAVING count(DISTINCT campaign."partner_id") = 1
)
UPDATE "public"."Complaints" AS complaint
SET "partner_id" = single_partner_orders.partner_id
FROM single_partner_orders
WHERE complaint."partner_id" IS NULL
  AND complaint."order_id" = single_partner_orders."order_id";

UPDATE "public"."Complaints" AS complaint
SET "order_item_id" = order_item."item_id"
FROM "public"."Order_Items" AS order_item
WHERE complaint."order_id" = order_item."order_id"
  AND complaint."campaign_id" = order_item."campaign_id";

UPDATE "public"."Complaints"
SET "closed_at" = COALESCE("resolved_at", "updated_at")
WHERE "status" = 'CLOSED';

ALTER TABLE "public"."Complaints"
  DROP CONSTRAINT IF EXISTS "Complaints_resolution_state_check",
  ADD CONSTRAINT "Complaints_resolution_state_check"
    CHECK (
      (
        "status" IN (
          'OPEN',
          'IN_REVIEW',
          'WAITING_PARTNER',
          'WAITING_CUSTOMER'
        )
        AND "resolved_at" IS NULL
      )
      OR
      (
        "status" IN ('RESOLVED', 'REJECTED', 'CLOSED')
        AND "resolved_at" IS NOT NULL
      )
    ),
  ADD CONSTRAINT "Complaints_closed_state_check"
    CHECK (
      ("status" = 'CLOSED' AND "closed_at" IS NOT NULL)
      OR ("status" <> 'CLOSED' AND "closed_at" IS NULL)
    ),
  ADD CONSTRAINT "Complaints_version_check" CHECK ("version" > 0),
  ADD CONSTRAINT "Complaints_partner_id_fkey"
    FOREIGN KEY ("partner_id") REFERENCES "public"."Partners"("partner_id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Complaints_assigned_admin_id_fkey"
    FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."Users"("user_id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Complaints_order_item_id_fkey"
    FOREIGN KEY ("order_item_id") REFERENCES "public"."Order_Items"("item_id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Complaints_voucher_code_id_fkey"
    FOREIGN KEY ("voucher_code_id") REFERENCES "public"."Voucher_Codes"("code_id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Complaints_partner_status_updated_idx"
  ON "public"."Complaints"("partner_id", "status", "updated_at" DESC);
CREATE INDEX "Complaints_assignee_status_updated_idx"
  ON "public"."Complaints"("assigned_admin_id", "status", "updated_at" DESC);
CREATE INDEX "Complaints_order_item_id_idx"
  ON "public"."Complaints"("order_item_id");
CREATE INDEX "Complaints_voucher_code_id_idx"
  ON "public"."Complaints"("voucher_code_id");

CREATE TABLE "public"."Complaint_Messages" (
  "message_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "complaint_id" UUID NOT NULL,
  "sender_id" UUID,
  "sender_role_snapshot" "public"."UserRole",
  "visibility" "public"."ComplaintMessageVisibility" NOT NULL DEFAULT 'ALL_PARTIES',
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Complaint_Messages_pkey" PRIMARY KEY ("message_id"),
  CONSTRAINT "Complaint_Messages_body_check" CHECK (btrim("body") <> ''),
  CONSTRAINT "Complaint_Messages_complaint_id_fkey"
    FOREIGN KEY ("complaint_id") REFERENCES "public"."Complaints"("complaint_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Complaint_Messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "public"."Users"("user_id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Complaint_Messages_complaint_created_idx"
  ON "public"."Complaint_Messages"("complaint_id", "created_at");

CREATE TABLE "public"."Complaint_Events" (
  "event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "complaint_id" UUID NOT NULL,
  "actor_id" UUID,
  "actor_role_snapshot" "public"."UserRole",
  "event_type" VARCHAR(100) NOT NULL,
  "from_status" "public"."ComplaintStatus",
  "to_status" "public"."ComplaintStatus",
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Complaint_Events_pkey" PRIMARY KEY ("event_id"),
  CONSTRAINT "Complaint_Events_event_type_check"
    CHECK (btrim("event_type") <> ''),
  CONSTRAINT "Complaint_Events_complaint_id_fkey"
    FOREIGN KEY ("complaint_id") REFERENCES "public"."Complaints"("complaint_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Complaint_Events_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "public"."Users"("user_id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Complaint_Events_complaint_created_idx"
  ON "public"."Complaint_Events"("complaint_id", "created_at");

INSERT INTO "public"."Complaint_Messages" (
  "complaint_id",
  "sender_id",
  "sender_role_snapshot",
  "body",
  "created_at"
)
SELECT
  complaint."complaint_id",
  complaint."resolved_by_id",
  CASE
    WHEN complaint."resolved_by_id" IS NULL THEN NULL
    ELSE 'ADMIN'::"public"."UserRole"
  END,
  complaint."resolution_response",
  COALESCE(complaint."resolved_at", complaint."updated_at")
FROM "public"."Complaints" AS complaint
WHERE complaint."resolution_response" IS NOT NULL
  AND btrim(complaint."resolution_response") <> '';

INSERT INTO "public"."Complaint_Events" (
  "complaint_id",
  "actor_id",
  "actor_role_snapshot",
  "event_type",
  "to_status",
  "metadata",
  "created_at"
)
SELECT
  complaint."complaint_id",
  complaint."resolved_by_id",
  CASE
    WHEN complaint."resolved_by_id" IS NULL THEN NULL
    ELSE 'ADMIN'::"public"."UserRole"
  END,
  'LEGACY_COMPLAINT_IMPORTED',
  complaint."status",
  jsonb_build_object('legacyBackfill', true),
  complaint."updated_at"
FROM "public"."Complaints" AS complaint;

REVOKE ALL PRIVILEGES ON TABLE
  "public"."Complaint_Messages",
  "public"."Complaint_Events"
FROM anon, authenticated;

ALTER TABLE "public"."Complaint_Messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Complaint_Events" ENABLE ROW LEVEL SECURITY;

COMMIT;
