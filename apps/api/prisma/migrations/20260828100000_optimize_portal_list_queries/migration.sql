-- Indexes for server-side pagination, status filters and aggregate joins.
CREATE INDEX "Users_role_status_created_at_idx"
ON "Users" ("role", "status", "created_at" DESC);

CREATE INDEX "Users_status_created_at_idx"
ON "Users" ("status", "created_at" DESC);

CREATE INDEX "Users_partner_role_created_at_idx"
ON "Users" ("partner_id", "role", "created_at" DESC);

CREATE INDEX "Partners_approval_account_created_at_idx"
ON "Partners" ("approval_status", "account_status", "created_at" DESC);

CREATE INDEX "Partners_account_created_at_idx"
ON "Partners" ("account_status", "created_at" DESC);

CREATE INDEX "Branches_partner_name_idx"
ON "Branches" ("partner_id", "name");

CREATE INDEX "Voucher_Campaigns_status_created_at_idx"
ON "Voucher_Campaigns" ("status", "created_at" DESC);

CREATE INDEX "Voucher_Campaigns_partner_status_created_at_idx"
ON "Voucher_Campaigns" ("partner_id", "status", "created_at" DESC);

CREATE INDEX "Orders_payment_status_created_at_idx"
ON "Orders" ("payment_status", "created_at" DESC);

CREATE INDEX "Orders_order_status_created_at_idx"
ON "Orders" ("order_status", "created_at" DESC);

DROP INDEX "Voucher_Codes_item_id_idx";

CREATE INDEX "Voucher_Codes_item_status_idx"
ON "Voucher_Codes" ("item_id", "status");
