-- Keep application data private from Supabase's browser-facing roles.
-- NestJS connects directly as a database role and remains the only application
-- entry point for these business tables. Deliberately do not FORCE RLS because
-- the table owner must retain access for migrations and the backend runtime.

BEGIN;

REVOKE ALL PRIVILEGES ON TABLE
  "public"."Users",
  "public"."Partners",
  "public"."Branches",
  "public"."Voucher_Campaigns",
  "public"."Campaign_Branches",
  "public"."Orders",
  "public"."Order_Items",
  "public"."Inventory_Reservations",
  "public"."Payment_Transactions",
  "public"."Payment_Webhook_Events",
  "public"."Payment_Refunds",
  "public"."Voucher_Codes",
  "public"."Voucher_Usage_Log",
  "public"."Audit_Logs",
  "public"."Cart_Items",
  "public"."Voucher_Reviews"
FROM anon, authenticated;

ALTER TABLE "public"."Users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Partners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Voucher_Campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Campaign_Branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Order_Items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Inventory_Reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Payment_Transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Payment_Webhook_Events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Payment_Refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Voucher_Codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Voucher_Usage_Log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Audit_Logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Cart_Items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Voucher_Reviews" ENABLE ROW LEVEL SECURITY;

-- Preserve the same deny-by-default posture for future Prisma-owned objects.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

COMMIT;
