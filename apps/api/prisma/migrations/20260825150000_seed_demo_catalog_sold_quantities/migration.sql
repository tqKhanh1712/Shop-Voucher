-- Seed deterministic popularity figures for the imported Giftpop demo catalog.
-- This migration intentionally updates presentation metadata only: it does not
-- create fake orders, reservations, cart items, voucher codes, or payments.
WITH eligible_campaigns AS (
  SELECT
    campaign."campaign_id",
    campaign."capacity",
    campaign."reserved_stock",
    ROW_NUMBER() OVER (
      ORDER BY MD5(campaign."external_id"), campaign."external_id"
    ) AS sold_out_rank,
    (
      ('x' || SUBSTRING(MD5(campaign."external_id"), 1, 8))::BIT(32)::BIGINT
      % 100
    ) AS popularity_bucket,
    (
      ('x' || SUBSTRING(MD5(campaign."external_id"), 9, 8))::BIT(32)::BIGINT
    ) AS popularity_variant
  FROM "public"."Voucher_Campaigns" AS campaign
  WHERE campaign."external_source" = 'giftpop.vn'
    AND campaign."external_id" IS NOT NULL
    AND campaign."sold_quantity" = 0
    AND campaign."reserved_stock" = 0
    AND NOT EXISTS (
      SELECT 1
      FROM "public"."Order_Items" AS order_item
      WHERE order_item."campaign_id" = campaign."campaign_id"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "public"."Inventory_Reservations" AS reservation
      WHERE reservation."campaign_id" = campaign."campaign_id"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "public"."Cart_Items" AS cart_item
      WHERE cart_item."campaign_id" = campaign."campaign_id"
    )
),
popularity_assignments AS (
  SELECT
    "campaign_id",
    CASE
      -- Keep a small, deterministic sold-out cohort visible in the demo catalog.
      WHEN sold_out_rank <= 5 THEN "capacity"
      ELSE LEAST(
        GREATEST("capacity" - "reserved_stock" - 1, 0),
        CASE
          WHEN popularity_bucket < 10 THEN popularity_variant % 4
          WHEN popularity_bucket < 35 THEN 4 + popularity_variant % 12
          WHEN popularity_bucket < 70 THEN 16 + popularity_variant % 24
          WHEN popularity_bucket < 90 THEN 40 + popularity_variant % 25
          ELSE 65 + popularity_variant % 24
        END
      )
    END::INTEGER AS sold_quantity
  FROM eligible_campaigns
)
UPDATE "public"."Voucher_Campaigns" AS campaign
SET "sold_quantity" = assignment.sold_quantity
FROM popularity_assignments AS assignment
WHERE campaign."campaign_id" = assignment."campaign_id";
