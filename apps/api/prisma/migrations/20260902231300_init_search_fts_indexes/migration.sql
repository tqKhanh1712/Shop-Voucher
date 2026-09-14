-- prisma migrate: transaction=false

CREATE INDEX CONCURRENTLY "idx_campaigns_search_vector" ON "Voucher_Campaigns" USING GIN ("search_vector");
CREATE INDEX CONCURRENTLY "idx_campaigns_title_trgm" ON "Voucher_Campaigns" USING GIN ("title" gin_trgm_ops);
