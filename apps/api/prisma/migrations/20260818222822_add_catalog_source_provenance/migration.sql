-- AlterTable
ALTER TABLE "Branches"
ADD COLUMN "source_url" TEXT,
ADD COLUMN "external_source" VARCHAR(100),
ADD COLUMN "external_id" VARCHAR(255),
ADD COLUMN "imported_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "Voucher_Campaigns"
ADD COLUMN "thumbnail_url" TEXT,
ADD COLUMN "source_url" TEXT,
ADD COLUMN "external_source" VARCHAR(100),
ADD COLUMN "external_id" VARCHAR(255),
ADD COLUMN "imported_at" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "Branches_external_source_external_id_key"
ON "Branches"("external_source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_Campaigns_external_source_external_id_key"
ON "Voucher_Campaigns"("external_source", "external_id");

-- AddConstraint
ALTER TABLE "Branches"
ADD CONSTRAINT "Branches_source_provenance_check"
CHECK (
  (external_source IS NULL AND external_id IS NULL AND source_url IS NULL AND imported_at IS NULL)
  OR (
    NULLIF(BTRIM(external_source), '') IS NOT NULL
    AND NULLIF(BTRIM(external_id), '') IS NOT NULL
    AND source_url ~ '^https://'
    AND imported_at IS NOT NULL
  )
);

-- AddConstraint
ALTER TABLE "Voucher_Campaigns"
ADD CONSTRAINT "Voucher_Campaigns_thumbnail_url_check"
CHECK (thumbnail_url IS NULL OR thumbnail_url ~ '^https://');

-- AddConstraint
ALTER TABLE "Voucher_Campaigns"
ADD CONSTRAINT "Voucher_Campaigns_source_provenance_check"
CHECK (
  (external_source IS NULL AND external_id IS NULL AND source_url IS NULL AND imported_at IS NULL)
  OR (
    NULLIF(BTRIM(external_source), '') IS NOT NULL
    AND NULLIF(BTRIM(external_id), '') IS NOT NULL
    AND source_url ~ '^https://'
    AND imported_at IS NOT NULL
  )
);
