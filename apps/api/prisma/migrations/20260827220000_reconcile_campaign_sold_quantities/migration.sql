-- Rebuild the operational sold counter from voucher codes that still represent
-- a sold unit. This removes the synthetic Giftpop popularity values introduced
-- by 20260825150000_seed_demo_catalog_sold_quantities.
-- CANCELLED codes are historical issuances whose stock has been returned.
WITH actual_sales AS (
  SELECT
    campaign."campaign_id",
    COUNT(code."code_id") FILTER (
      WHERE code."status" <> 'CANCELLED'
    )::INTEGER AS sold_quantity
  FROM "public"."Voucher_Campaigns" AS campaign
  LEFT JOIN "public"."Order_Items" AS item
    ON item."campaign_id" = campaign."campaign_id"
  LEFT JOIN "public"."Voucher_Codes" AS code
    ON code."item_id" = item."item_id"
  GROUP BY campaign."campaign_id"
)
UPDATE "public"."Voucher_Campaigns" AS campaign
SET "sold_quantity" = actual_sales.sold_quantity
FROM actual_sales
WHERE campaign."campaign_id" = actual_sales."campaign_id"
  AND campaign."sold_quantity" IS DISTINCT FROM actual_sales.sold_quantity;
