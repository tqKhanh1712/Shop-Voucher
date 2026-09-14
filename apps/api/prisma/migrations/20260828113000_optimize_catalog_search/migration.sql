-- Supports the public catalog's exact availability predicate and sale window.
-- Kept as a partial index because draft, expired, and exhausted campaigns never
-- participate in public search or category facet counts.
CREATE INDEX IF NOT EXISTS "Voucher_Campaigns_public_available_window_idx"
ON "Voucher_Campaigns" ("sale_end_time", "sale_start_time", "created_at" DESC)
WHERE "status" = 'APPROVED'
  AND ("capacity" - "sold_quantity" - "reserved_stock") > 0;
