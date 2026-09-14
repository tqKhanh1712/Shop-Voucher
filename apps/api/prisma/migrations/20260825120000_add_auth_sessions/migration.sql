-- Replace the single refresh token stored on Users with server-side sessions.
-- Existing refresh tokens are intentionally invalidated by this migration.

BEGIN;

CREATE TABLE "public"."Auth_Sessions" (
    "session_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token_hash" CHAR(64) NOT NULL,
    "user_agent" VARCHAR(512),
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ NOT NULL,
    "idle_expires_at" TIMESTAMPTZ NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "Auth_Sessions_pkey" PRIMARY KEY ("session_id"),
    CONSTRAINT "Auth_Sessions_refresh_token_hash_key" UNIQUE ("refresh_token_hash"),
    CONSTRAINT "Auth_Sessions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."Users"("user_id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Auth_Sessions_expiry_order_check"
      CHECK ("created_at" <= "idle_expires_at" AND "idle_expires_at" <= "absolute_expires_at")
);

CREATE INDEX "Auth_Sessions_user_revoked_idx"
  ON "public"."Auth_Sessions"("user_id", "revoked_at");
CREATE INDEX "Auth_Sessions_idle_expires_idx"
  ON "public"."Auth_Sessions"("idle_expires_at");
CREATE INDEX "Auth_Sessions_absolute_expires_idx"
  ON "public"."Auth_Sessions"("absolute_expires_at");

REVOKE ALL PRIVILEGES ON TABLE "public"."Auth_Sessions"
FROM anon, authenticated;
ALTER TABLE "public"."Auth_Sessions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."Users"
  DROP COLUMN "refresh_token_hash",
  DROP COLUMN "refresh_token_expires_at";

COMMIT;
