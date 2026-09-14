-- Create Extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create function immutable_unaccent
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text AS
$func$
  SELECT public.unaccent('public.unaccent', $1)
$func$ LANGUAGE sql IMMUTABLE;

-- CreateTable SearchSynonym
CREATE TABLE "search_synonyms" (
    "id" SERIAL NOT NULL,
    "keyword" TEXT NOT NULL,
    "expand_to" TEXT NOT NULL,
    "category_tag" TEXT,
    "weight" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable SearchLog
CREATE TABLE "search_logs" (
    "id" SERIAL NOT NULL,
    "query_raw" TEXT NOT NULL,
    "query_expanded" TEXT[],
    "category_intent" TEXT[],
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "clicked_product_id" UUID,
    "session_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex search_synonyms
CREATE INDEX "idx_synonyms_keyword" ON "search_synonyms"("keyword");
CREATE INDEX "idx_synonyms_category" ON "search_synonyms"("category_tag");

-- CreateIndex search_logs
CREATE INDEX "idx_search_logs_query" ON "search_logs"("query_raw");
CREATE INDEX "idx_search_logs_empty" ON "search_logs"("result_count");

-- AlterTable VoucherCampaigns
ALTER TABLE "Voucher_Campaigns" ADD COLUMN "search_vector" tsvector;

-- Create Trigger function
CREATE OR REPLACE FUNCTION update_campaign_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('simple', immutable_unaccent(coalesce(NEW.title, ''))), 'A') || 
    setweight(to_tsvector('simple', immutable_unaccent(coalesce(NEW.description, ''))), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create Trigger for INSERT
CREATE TRIGGER trg_campaign_search_vector_insert
BEFORE INSERT ON "Voucher_Campaigns"
FOR EACH ROW
EXECUTE FUNCTION update_campaign_search_vector();

-- Create Trigger for UPDATE
CREATE TRIGGER trg_campaign_search_vector_update
BEFORE UPDATE ON "Voucher_Campaigns"
FOR EACH ROW
WHEN (OLD.title IS DISTINCT FROM NEW.title OR OLD.description IS DISTINCT FROM NEW.description)
EXECUTE FUNCTION update_campaign_search_vector();
