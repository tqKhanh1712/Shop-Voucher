ALTER TABLE "public"."Activity_Logs"
  ADD COLUMN "actor_name_snapshot" VARCHAR(255),
  ADD COLUMN "actor_email_snapshot" VARCHAR(255);

UPDATE "public"."Activity_Logs" AS activity
SET
  "actor_name_snapshot" = COALESCE(activity."metadata" ->> 'adminNameSnapshot', actor."full_name"),
  "actor_email_snapshot" = COALESCE(activity."metadata" ->> 'adminEmailSnapshot', actor."email")
FROM "public"."Users" AS actor
WHERE actor."user_id" = activity."actor_user_id";

INSERT INTO "public"."Activity_Logs" (
  "actor_user_id", "actor_role_snapshot", "actor_name_snapshot", "actor_email_snapshot",
  "category", "action_type", "target_entity", "target_id", "metadata", "occurred_at"
)
SELECT
  audit."admin_id", 'ADMIN'::"public"."UserRole", audit."admin_name_snapshot",
  audit."admin_email_snapshot", 'ADMIN'::"public"."ActivityCategory", audit."action_type",
  audit."target_entity", audit."target_id"::text,
  jsonb_build_object('legacyAuditLogId', audit."log_id"), audit."timestamp"
FROM "public"."Audit_Logs" AS audit
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."Activity_Logs" AS activity
  WHERE activity."metadata" ->> 'legacyAuditLogId' = audit."log_id"::text
);

CREATE INDEX "Activity_Logs_action_occurred_at_idx"
  ON "public"."Activity_Logs"("action_type", "occurred_at" DESC);
