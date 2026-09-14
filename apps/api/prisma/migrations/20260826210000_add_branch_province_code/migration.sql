ALTER TABLE "Branches"
ADD COLUMN "province_code" CHAR(2);

UPDATE "Branches"
SET "province_code" = '79'
WHERE "address" ILIKE ANY (
  ARRAY['%Hồ Chí Minh%', '%TP HCM%', '%TP. HCM%', '%TPHCM%', '%Sài Gòn%']
);

UPDATE "Branches"
SET "province_code" = '01'
WHERE "address" ILIKE '%Hà Nội%';

CREATE INDEX "Branches_province_code_idx" ON "Branches"("province_code");
