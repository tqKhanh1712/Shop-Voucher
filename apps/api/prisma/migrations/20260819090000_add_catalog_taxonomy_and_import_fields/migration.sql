-- AlterTable
ALTER TABLE "Voucher_Campaigns"
ADD COLUMN "terms_and_conditions" TEXT,
ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'VND',
ADD COLUMN "usage_validity_days" INTEGER,
ADD COLUMN "source_content_hash" CHAR(64),
ADD COLUMN "last_seen_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "Catalog_Brands" (
  "brand_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "display_name" VARCHAR(255) NOT NULL,
  "logo_url" TEXT,
  "source_url" TEXT,
  "external_source" VARCHAR(100) NOT NULL,
  "external_id" VARCHAR(255) NOT NULL,
  "imported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Catalog_Brands_pkey" PRIMARY KEY ("brand_id"),
  CONSTRAINT "Catalog_Brands_source_check" CHECK (
    NULLIF(BTRIM(external_source), '') IS NOT NULL
    AND NULLIF(BTRIM(external_id), '') IS NOT NULL
    AND NULLIF(BTRIM(display_name), '') IS NOT NULL
    AND (logo_url IS NULL OR logo_url ~ '^https://')
    AND (source_url IS NULL OR source_url ~ '^https://')
  )
);

-- CreateTable
CREATE TABLE "Voucher_Categories" (
  "category_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(50) NOT NULL,
  "name_vi" VARCHAR(100) NOT NULL,
  "parent_id" UUID,
  "external_source" VARCHAR(100),
  "external_id" VARCHAR(255),
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Voucher_Categories_pkey" PRIMARY KEY ("category_id"),
  CONSTRAINT "Voucher_Categories_values_check" CHECK (
    NULLIF(BTRIM(code), '') IS NOT NULL
    AND NULLIF(BTRIM(name_vi), '') IS NOT NULL
    AND display_order >= 0
    AND parent_id IS DISTINCT FROM category_id
    AND (
      (external_source IS NULL AND external_id IS NULL)
      OR (
        NULLIF(BTRIM(external_source), '') IS NOT NULL
        AND NULLIF(BTRIM(external_id), '') IS NOT NULL
      )
    )
  )
);

-- CreateTable
CREATE TABLE "Campaign_Brands" (
  "campaign_id" UUID NOT NULL,
  "brand_id" UUID NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Campaign_Brands_pkey" PRIMARY KEY ("campaign_id", "brand_id")
);

-- CreateTable
CREATE TABLE "Campaign_Categories" (
  "campaign_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Campaign_Categories_pkey" PRIMARY KEY ("campaign_id", "category_id")
);

-- AddConstraint
ALTER TABLE "Voucher_Campaigns"
ADD CONSTRAINT "Voucher_Campaigns_catalog_import_fields_check"
CHECK (
  currency ~ '^[A-Z]{3}$'
  AND (usage_validity_days IS NULL OR usage_validity_days > 0)
  AND (source_content_hash IS NULL OR source_content_hash ~ '^[0-9a-f]{64}$')
  AND (last_seen_at IS NULL OR imported_at IS NOT NULL)
);

-- CreateIndex
CREATE UNIQUE INDEX "Catalog_Brands_external_source_external_id_key"
ON "Catalog_Brands"("external_source", "external_id");

-- CreateIndex
CREATE INDEX "Catalog_Brands_display_name_idx"
ON "Catalog_Brands"("display_name");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_Categories_code_key"
ON "Voucher_Categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_Categories_external_source_external_id_key"
ON "Voucher_Categories"("external_source", "external_id");

-- CreateIndex
CREATE INDEX "Voucher_Categories_parent_order_idx"
ON "Voucher_Categories"("parent_id", "display_order");

-- CreateIndex
CREATE INDEX "Campaign_Brands_brand_campaign_idx"
ON "Campaign_Brands"("brand_id", "campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_Brands_one_primary_per_campaign_key"
ON "Campaign_Brands"("campaign_id") WHERE "is_primary" = true;

-- CreateIndex
CREATE INDEX "Campaign_Categories_category_campaign_idx"
ON "Campaign_Categories"("category_id", "campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_Categories_one_primary_per_campaign_key"
ON "Campaign_Categories"("campaign_id") WHERE "is_primary" = true;

-- AddForeignKey
ALTER TABLE "Voucher_Categories"
ADD CONSTRAINT "Voucher_Categories_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "Voucher_Categories"("category_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign_Brands"
ADD CONSTRAINT "Campaign_Brands_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "Voucher_Campaigns"("campaign_id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign_Brands"
ADD CONSTRAINT "Campaign_Brands_brand_id_fkey"
FOREIGN KEY ("brand_id") REFERENCES "Catalog_Brands"("brand_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign_Categories"
ADD CONSTRAINT "Campaign_Categories_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "Voucher_Campaigns"("campaign_id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign_Categories"
ADD CONSTRAINT "Campaign_Categories_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "Voucher_Categories"("category_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase browser-facing roles remain deny-by-default. Frontend reads through NestJS only.
ALTER TABLE "Catalog_Brands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Voucher_Categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Campaign_Brands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Campaign_Categories" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "Catalog_Brands" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "Voucher_Categories" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "Campaign_Brands" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "Campaign_Categories" FROM PUBLIC, anon, authenticated;
