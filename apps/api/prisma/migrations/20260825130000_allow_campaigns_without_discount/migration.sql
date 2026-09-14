-- Campaigns without a discount store NULL in sale_price and sell at original_price.
-- Discounted campaigns must still have a positive sale_price below original_price.

ALTER TABLE "public"."Voucher_Campaigns"
  ALTER COLUMN "sale_price" DROP NOT NULL;

ALTER TABLE "public"."Voucher_Campaigns"
  DROP CONSTRAINT "Voucher_Campaigns_price_check";

ALTER TABLE "public"."Voucher_Campaigns"
  ADD CONSTRAINT "Voucher_Campaigns_price_check"
  CHECK (
    "original_price" > 0
    AND (
      "sale_price" IS NULL
      OR ("sale_price" > 0 AND "sale_price" < "original_price")
    )
  );
