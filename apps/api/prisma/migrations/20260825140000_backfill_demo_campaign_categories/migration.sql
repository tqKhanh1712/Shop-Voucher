-- Attach the three public seed campaigns to the normalized catalog taxonomy.
-- The NOT EXISTS guard keeps this data repair idempotent in databases where the
-- campaigns were already categorized manually.
WITH category_mapping (campaign_title, category_code) AS (
  VALUES
    ('Voucher Buffet Lẩu 199k tại ABC', 'GIFTPOP_VN_A104'),
    ('Voucher Nước uống giảm giá 50%', 'GIFTPOP_VN_A101'),
    ('Voucher Mua sắm Thời trang XYZ 100k', 'GIFTPOP_VN_A108')
)
INSERT INTO "public"."Campaign_Categories" (
  "campaign_id",
  "category_id",
  "is_primary"
)
SELECT
  campaign."campaign_id",
  category."category_id",
  TRUE
FROM category_mapping AS mapping
JOIN "public"."Voucher_Campaigns" AS campaign
  ON campaign."title" = mapping.campaign_title
 AND campaign."external_source" IS NULL
JOIN "public"."Voucher_Categories" AS category
  ON category."code" = mapping.category_code
WHERE NOT EXISTS (
  SELECT 1
  FROM "public"."Campaign_Categories" AS existing
  WHERE existing."campaign_id" = campaign."campaign_id"
)
ON CONFLICT ("campaign_id", "category_id") DO NOTHING;
