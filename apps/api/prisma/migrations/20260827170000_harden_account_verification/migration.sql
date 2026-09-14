BEGIN;

ALTER TABLE "public"."Users"
  ADD COLUMN "account_verification_code_hash" CHAR(64),
  ADD COLUMN "account_verification_expires_at" TIMESTAMPTZ;

CREATE INDEX "Users_account_verification_expires_idx"
  ON "public"."Users"("account_verification_expires_at")
  WHERE "account_verification_code_hash" IS NOT NULL;

COMMIT;
